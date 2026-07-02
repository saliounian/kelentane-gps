import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import type { TraccarDevice, TraccarPosition } from "./traccar.types";

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

  getDevices(): Promise<TraccarDevice[]> {
    return this.get<TraccarDevice[]>("/api/devices");
  }

  /** Toutes les dernières positions connues (un point par device). */
  getPositions(): Promise<TraccarPosition[]> {
    return this.get<TraccarPosition[]>("/api/positions");
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
