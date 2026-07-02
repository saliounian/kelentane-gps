import { randomUUID } from "crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TraccarService } from "../traccar/traccar.service";

/** Types de commande exposés au mobile (§9.4). */
export type CommandType = "engineStop" | "engineResume" | "gpsReboot";
export type CommandState = "success" | "offline" | "error";

const SENSITIVE: CommandType[] = ["engineStop", "engineResume"];
const TRACCAR_TYPE: Record<CommandType, string> = {
  engineStop: "engineStop",
  engineResume: "engineResume",
  gpsReboot: "rebootDevice",
};

@Injectable()
export class CommandsService {
  // Suivi d'ACK en mémoire (provisoire ; l'ACK réel du boîtier viendra des
  // événements Traccar au moteur d'alarmes, étape 6).
  private readonly acks = new Map<string, { state: CommandState; at: number }>();

  constructor(
    private readonly traccar: TraccarService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Vérification du mot de passe des commandes sensibles.
   * STUB — sera remplacé par une vraie vérif (auth compte) à l'étape 9.
   */
  private verifyPassword(password?: string): boolean {
    const expected = this.config.get<string>("COMMAND_PASSWORD") ?? "123456";
    return !!password && password === expected;
  }

  async dispatch(
    deviceId: number,
    type: CommandType,
    password?: string,
  ): Promise<{ ackId: string; state: CommandState }> {
    if (SENSITIVE.includes(type) && !this.verifyPassword(password)) {
      throw new UnauthorizedException("Mot de passe requis");
    }
    const ackId = randomUUID();

    // Véhicule hors ligne → non transmise (sémantique runCommand maquette).
    let offline = false;
    try {
      const devices = await this.traccar.getDevices();
      const dev = devices.find((d) => d.id === deviceId);
      offline = !dev || dev.status === "offline";
    } catch {
      return this.record(ackId, "error");
    }
    if (offline) return this.record(ackId, "offline");

    try {
      await this.traccar.sendCommand(deviceId, TRACCAR_TYPE[type]);
      return this.record(ackId, "success");
    } catch {
      return this.record(ackId, "error");
    }
  }

  status(ackId: string): { state: CommandState } | null {
    const e = this.acks.get(ackId);
    return e ? { state: e.state } : null;
  }

  private record(ackId: string, state: CommandState): { ackId: string; state: CommandState } {
    this.acks.set(ackId, { state, at: Date.now() });
    return { ackId, state };
  }
}
