import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import type {
  TraccarDevice,
  TraccarEvent,
  TraccarPosition,
  TraccarStop,
  TraccarSummary,
  TraccarTrip,
} from "./traccar.types";

/**
 * Client de façade vers Traccar. Les identifiants Traccar vivent UNIQUEMENT
 * côté serveur (env), jamais dans le mobile. Le mobile ne parle qu'à cette API.
 */
@Injectable()
export class TraccarService {
  private readonly log = new Logger(TraccarService.name);
  private readonly baseUrl: string;
  private readonly auth: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.baseUrl = (config.get<string>("TRACCAR_URL") ?? "http://localhost:8082").replace(/\/$/, "");
    const user = config.get<string>("TRACCAR_USER") ?? "";
    const pass = config.get<string>("TRACCAR_PASS") ?? "";
    this.auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }

  private async get<T>(path: string): Promise<T> {
    const res = await firstValueFrom(
      this.http.get<T>(`${this.baseUrl}${path}`, {
        headers: { Authorization: this.auth, Accept: "application/json" },
        timeout: 8000,
      }),
    );
    return res.data;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await firstValueFrom(
      this.http.post<T>(`${this.baseUrl}${path}`, body, {
        headers: {
          Authorization: this.auth,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }),
    );
    return res.data;
  }

  /** Envoi immédiat d'une commande à un device (Traccar /commands/send). */
  sendCommand(deviceId: number, type: string): Promise<unknown> {
    return this.post("/api/commands/send", { deviceId, type });
  }

  private async del(path: string, body?: unknown): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}${path}`, {
        headers: { Authorization: this.auth, "Content-Type": "application/json" },
        timeout: 8000,
        data: body,
      }),
    );
  }

  // ---- Géofences (Traccar geofences + permissions device↔geofence) ----
  createGeofence(name: string, areaWkt: string): Promise<{ id: number }> {
    return this.post<{ id: number }>("/api/geofences", { name, area: areaWkt });
  }
  deleteGeofence(id: number): Promise<void> {
    return this.del(`/api/geofences/${id}`);
  }
  /** Lie une géofence à un device → active les événements geofenceEnter/Exit. */
  linkGeofence(deviceId: number, geofenceId: number): Promise<unknown> {
    return this.post("/api/permissions", { deviceId, geofenceId });
  }
  unlinkGeofence(deviceId: number, geofenceId: number): Promise<void> {
    return this.del("/api/permissions", { deviceId, geofenceId });
  }

  getDevices(): Promise<TraccarDevice[]> {
    return this.get<TraccarDevice[]>("/api/devices");
  }

  /** Toutes les dernières positions connues (un point par device). */
  getPositions(): Promise<TraccarPosition[]> {
    return this.get<TraccarPosition[]>("/api/positions");
  }

  /** Événements (reports/events) sur une fenêtre, pour un ou plusieurs devices. */
  getEvents(deviceIds: number[], fromIso: string, toIso: string): Promise<TraccarEvent[]> {
    if (deviceIds.length === 0) return Promise.resolve([]);
    const params = new URLSearchParams();
    params.set("from", fromIso);
    params.set("to", toIso);
    for (const id of deviceIds) params.append("deviceId", String(id));
    return this.get<TraccarEvent[]>(`/api/reports/events?${params.toString()}`);
  }

  private reportQuery(deviceIds: number[], fromIso: string, toIso: string, extra?: Record<string, string>): string {
    const params = new URLSearchParams({ from: fromIso, to: toIso, ...extra });
    for (const id of deviceIds) params.append("deviceId", String(id));
    return params.toString();
  }

  getSummary(deviceIds: number[], fromIso: string, toIso: string, daily = false): Promise<TraccarSummary[]> {
    if (deviceIds.length === 0) return Promise.resolve([]);
    const q = this.reportQuery(deviceIds, fromIso, toIso, daily ? { daily: "true" } : undefined);
    return this.get<TraccarSummary[]>(`/api/reports/summary?${q}`);
  }

  getTrips(deviceId: number, fromIso: string, toIso: string): Promise<TraccarTrip[]> {
    return this.get<TraccarTrip[]>(`/api/reports/trips?${this.reportQuery([deviceId], fromIso, toIso)}`);
  }

  getStops(deviceId: number, fromIso: string, toIso: string): Promise<TraccarStop[]> {
    return this.get<TraccarStop[]>(`/api/reports/stops?${this.reportQuery([deviceId], fromIso, toIso)}`);
  }

  getRoute(deviceId: number, fromIso: string, toIso: string): Promise<TraccarPosition[]> {
    return this.get<TraccarPosition[]>(`/api/reports/route?${this.reportQuery([deviceId], fromIso, toIso)}`);
  }

  /** Devices + positions en une passe, résilient si Traccar est injoignable. */
  async getFleet(): Promise<{ devices: TraccarDevice[]; positions: TraccarPosition[] }> {
    try {
      const [devices, positions] = await Promise.all([this.getDevices(), this.getPositions()]);
      return { devices, positions };
    } catch (e) {
      this.log.error(`Traccar injoignable (${this.baseUrl}): ${(e as Error).message}`);
      throw e;
    }
  }
}
