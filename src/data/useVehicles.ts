import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { fetchVehicles } from "./api";
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
            iconKey: ex.iconKey,
            model: ex.model ?? inc.model,
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
      setVehicles(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
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
        setVehicles(vs);
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
