import { randomUUID } from "crypto";
import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { TraccarService } from "../traccar/traccar.service";
import { SupabaseService } from "../supabase/supabase.service";
import { AccessService } from "../supabase/access.service";

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
  private readonly acks = new Map<string, { state: CommandState; at: number }>();

  constructor(
    private readonly traccar: TraccarService,
    private readonly supa: SupabaseService,
    private readonly access: AccessService,
  ) {}

  /**
   * Dispatch d'une commande. Les commandes sensibles exigent le mot de passe du
   * COMPTE (vérifié via Supabase, étape 9b — remplace le stub COMMAND_PASSWORD).
   */
  async dispatch(
    deviceId: number,
    type: CommandType,
    ctx: { userId: string; email: string; password?: string },
  ): Promise<{ ackId: string; state: CommandState }> {
    if (SENSITIVE.includes(type)) {
      const ok = !!ctx.password && (await this.supa.verifyPassword(ctx.email, ctx.password));
      if (!ok) throw new UnauthorizedException("Mot de passe incorrect");
    }
    const ackId = randomUUID();

    let offline = false;
    try {
      const devices = await this.traccar.getDevices();
      const dev = devices.find((d) => d.id === deviceId);
      const allowed = await this.access.allowed(ctx.userId);
      if (dev && !allowed.imeis.has(dev.uniqueId)) throw new ForbiddenException("Accès refusé à ce véhicule");
      offline = !dev || dev.status === "offline";
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
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
