import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { fetchVehicles } from "./api";
import { logError, toUserMessage } from "./errorMessages";
import { supabase } from "./supabase";
import { API_URL } from "../config/env";
import type { VehicleVM } from "../types/vehicle";

const POLL_MS = 10000; // polling de SECOURS uniquement (WebSocket déconnecté)

type State = {
  vehicles: VehicleVM[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  refresh: () => void;
};

/** Vrai si le paquet porte au moins une valeur de télémétrie (paquet de STATUT). */
function hasTelemetry(v: VehicleVM): boolean {
  return v.battery != null || v.charge != null || v.acc != null || v.voltage != null;
}

/**
 * Snapshot (HTTP `/vehicles` ou WS `snapshot`) : le serveur fait AUTORITÉ sur les
 * champs métier (nom, plaque, accès…) — on ne les fige pas. Seule la télémétrie
 * (§1), absente du dernier paquet quand c'est une position pure, reprend la
 * dernière valeur connue localement plutôt que de retomber à `N/D`.
 */
function mergeSnapshot(prev: VehicleVM[], list: VehicleVM[]): VehicleVM[] {
  const map = new Map(prev.map((v) => [v.id, v]));
  return list.map((inc) => {
    const ex = map.get(inc.id);
    const fresh = hasTelemetry(inc);
    return {
      ...inc,
      battery: inc.battery ?? ex?.battery ?? null,
      charge: inc.charge ?? ex?.charge ?? null,
      acc: inc.acc ?? ex?.acc ?? null,
      voltage: inc.voltage ?? ex?.voltage ?? null,
      telemetryAt: fresh ? inc.lastSeen : (ex?.telemetryAt ?? null),
    };
  });
}

/** Fusionne un lot de positions (VM Traccar-only) en préservant les champs métier. */
function mergePositions(prev: VehicleVM[], batch: VehicleVM[]): VehicleVM[] {
  const map = new Map(prev.map((v) => [v.id, v]));
  for (const inc of batch) {
    const ex = map.get(inc.id);
    map.set(
      inc.id,
      ex
        ? {
            ...inc,
            name: ex.name ?? inc.name,
            plate: ex.plate,
            type: ex.type,
            sim: ex.sim,
            phone: ex.phone ?? inc.phone,
            iccid: ex.iccid,
            owner: ex.owner ?? inc.owner,
            ownerId: ex.ownerId ?? inc.ownerId,
            iconKey: ex.iconKey,
            model: ex.model ?? inc.model,
            // §1 : télémétrie (batterie/charge/contact/tension) portée par les paquets
            // de STATUT, absente des paquets de position pure → `inc` la remet à null.
            // On conserve la DERNIÈRE valeur connue non-nulle, jamais écrasée par null
            // (`??` garde `false` : contact éteint / hors charge restent affichés).
            battery: inc.battery ?? ex.battery,
            charge: inc.charge ?? ex.charge,
            acc: inc.acc ?? ex.acc,
            voltage: inc.voltage ?? ex.voltage,
            // Date de la DERNIÈRE mise à jour réelle de ces valeurs (§1) : ne bouge
            // que sur un paquet de statut, sert à dater la télémétrie conservée.
            telemetryAt: hasTelemetry(inc) ? (inc.lastSeen ?? new Date().toISOString()) : (ex.telemetryAt ?? null),
            // Accès (§device_access) : porté par le snapshot HTTP/WS, absent des
            // positions Traccar (toVM → null). Préserver, sinon le premier tick
            // repasse accessRole à null → tout véhicule gaté « consultation ».
            accessRole: ex.accessRole ?? inc.accessRole,
            accessStatus: ex.accessStatus ?? inc.accessStatus,
          }
        : inc,
    );
  }
  return Array.from(map.values());
}

/**
 * Positions temps réel via le WebSocket relayé par la façade (Socket.io).
 * `snapshot` initial (view-model complet §6.1) puis `positions` incrémentales.
 * Secours : si le WebSocket est déconnecté, polling REST temporaire (reco auto
 * par Socket.io). L'API du hook est inchangée pour les écrans consommateurs.
 */
export function useVehicles(): State {
  const [vehicles, setVehicles] = useState<VehicleVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async () => {
    // re-résolution du périmètre côté WS (ex. après un claim de partage)
    socketRef.current?.emit("refresh");
    try {
      const data = await fetchVehicles();
      setVehicles((prev) => mergeSnapshot(prev, data));
      setError(null);
    } catch (e) {
      logError("useVehicles.load", e);
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const socket = io(API_URL, {
        auth: { token: data.session?.access_token },
        reconnection: true, // reco auto (backoff) ; polling REST de secours entre-temps
      });
      socketRef.current = socket;
      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));
      socket.on("snapshot", (vs: VehicleVM[]) => {
        setVehicles((prev) => mergeSnapshot(prev, vs));
        setLoading(false);
        setError(null);
      });
      socket.on("positions", (batch: VehicleVM[]) => setVehicles((prev) => mergePositions(prev, batch)));
    })();
    return () => {
      alive = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  // secours : polling seulement tant que le WebSocket n'est pas connecté
  useEffect(() => {
    if (connected) return;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [connected, load]);

  return { vehicles, loading, error, connected, refresh: load };
}
