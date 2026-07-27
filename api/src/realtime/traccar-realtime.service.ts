import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import WebSocket from "ws";
import { Subject } from "rxjs";
import { TraccarService } from "../traccar/traccar.service";
import { DevicesService } from "../supabase/devices.service";
import type { TraccarDevice, TraccarPosition, TraccarEvent } from "../traccar/traccar.types";
import { toVM } from "../vehicles/vehicle.mapper";
import type { VehicleVM } from "../vehicles/vehicle.vm";

interface SocketFrame {
  devices?: TraccarDevice[];
  positions?: TraccarPosition[];
  events?: TraccarEvent[];
}

/** Événement Traccar enrichi de l'identité device (imei + nom) pour le routage push. */
export interface AlarmEvent {
  event: TraccarEvent;
  imei: string;
  deviceName: string;
}

/**
 * Relais du WebSocket natif Traccar (/api/socket).
 * Se connecte au cœur GPS (login session → cookie → ws), reçoit les positions
 * en temps réel et les diffuse (mappées en VM Traccar-only) sur `positions$`.
 * Reconnexion automatique avec backoff. Ne fait AUCUN filtrage tenant ici :
 * l'isolation est appliquée par la gateway au moment de l'émission.
 */
@Injectable()
export class TraccarRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(TraccarRealtimeService.name);
  readonly positions$ = new Subject<VehicleVM[]>();
  /** Événements d'alarme (geofence, overspeed, contact…) pour le pont push. */
  readonly events$ = new Subject<AlarmEvent>();

  private readonly baseUrl: string;
  private readonly user: string;
  private readonly pass: string;
  private ws?: WebSocket;
  private stopped = false;
  private backoff = 2000;
  private readonly deviceById = new Map<number, TraccarDevice>();
  /**
   * Cache mémoire des IMEI dont le statut commercial est déjà réglé ('sold' confirmé
   * OU IMEI inconnu de la base) → on ne ré-écrit PAS la base à chaque tick (§2).
   * Un IMEI n'y entre qu'après un markSoldOnConnect sans erreur.
   */
  private readonly commercialSettled = new Set<string>();

  constructor(
    private readonly traccar: TraccarService,
    private readonly devices: DevicesService,
    config: ConfigService,
  ) {
    this.baseUrl = (config.get<string>("TRACCAR_URL") ?? "http://localhost:8082").replace(/\/$/, "");
    this.user = config.get<string>("TRACCAR_USER") ?? "";
    this.pass = config.get<string>("TRACCAR_PASS") ?? "";
  }

  onModuleInit(): void {
    void this.connect();
  }
  onModuleDestroy(): void {
    this.stopped = true;
    this.ws?.close();
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    try {
      const devices = await this.traccar.getDevices();
      for (const d of devices) this.deviceById.set(d.id, d);

      const cookie = await this.login();
      const wsUrl = this.baseUrl.replace(/^http/, "ws") + "/api/socket";
      const ws = new WebSocket(wsUrl, { headers: { Cookie: cookie } });
      this.ws = ws;

      ws.on("open", () => {
        this.backoff = 2000;
        this.log.log("WebSocket Traccar connecté");
      });
      ws.on("message", (raw: WebSocket.RawData) => this.onMessage(raw.toString()));
      ws.on("close", () => this.reconnect("close"));
      ws.on("error", (e) => {
        this.log.warn(`WS Traccar erreur: ${(e as Error).message}`);
        ws.close();
      });
    } catch (e) {
      this.log.warn(`Connexion Traccar impossible: ${(e as Error).message}`);
      this.reconnect("connect-fail");
    }
  }

  private reconnect(reason: string): void {
    if (this.stopped) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, 60000);
    this.log.debug(`Reconnexion Traccar dans ${delay}ms (${reason})`);
    setTimeout(() => void this.connect(), delay);
  }

  /** Login session Traccar → cookie JSESSIONID. */
  private async login(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `email=${encodeURIComponent(this.user)}&password=${encodeURIComponent(this.pass)}`,
    });
    if (!res.ok) throw new Error(`login ${res.status}`);
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) throw new Error("pas de cookie de session");
    return setCookie.split(";")[0];
  }

  private onMessage(raw: string): void {
    let frame: SocketFrame;
    try {
      frame = JSON.parse(raw) as SocketFrame;
    } catch {
      return;
    }
    if (frame.devices) {
      for (const d of frame.devices) this.deviceById.set(d.id, { ...this.deviceById.get(d.id), ...d });
    }
    if (frame.positions?.length) {
      const now = new Date();
      const vms: VehicleVM[] = [];
      const connectedImeis: string[] = [];
      for (const p of frame.positions) {
        const d = this.deviceById.get(p.deviceId);
        if (d) {
          vms.push(toVM(d, p, now));
          if (d.uniqueId) connectedImeis.push(d.uniqueId);
        }
      }
      if (vms.length) this.positions$.next(vms);
      // Auto-passage stock→sold : une position = preuve de connexion (§2). Non bloquant.
      void this.markConnected(connectedImeis);
    }
    if (frame.events?.length) {
      for (const event of frame.events) {
        const d = this.deviceById.get(event.deviceId);
        // Device inconnu (pas encore dans la map) → on ignore : pas d'imei pour router.
        if (!d?.uniqueId) continue;
        this.events$.next({ event, imei: d.uniqueId, deviceName: d.name ?? d.uniqueId });
      }
    }
  }

  /**
   * Passe en 'sold' les IMEI encore en 'stock' à leur 1re position (§2). Cache mémoire
   * `commercialSettled` → une seule écriture DB par IMEI et par process (les ticks
   * suivants ne touchent plus la base). Idempotent et irréversible côté base.
   */
  async markConnected(imeis: Iterable<string>): Promise<void> {
    if (!this.devices.enabled) return;
    for (const imei of new Set(imeis)) {
      if (this.commercialSettled.has(imei)) continue;
      const res = await this.devices.markSoldOnConnect(imei);
      if (res === "error") continue; // pas de cache → nouvelle tentative au prochain tick
      this.commercialSettled.add(imei);
      if (res === "flipped") this.log.log(`Device ${imei} → sold (1re connexion)`);
    }
  }
}
