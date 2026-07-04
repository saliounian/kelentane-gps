import { Logger } from "@nestjs/common";
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from "@nestjs/websockets";
import type { Socket } from "socket.io";
import type { Subscription } from "rxjs";
import { SupabaseService } from "../supabase/supabase.service";
import { AccessService } from "../supabase/access.service";
import { VehiclesService } from "../vehicles/vehicles.service";
import { TraccarRealtimeService } from "./traccar-realtime.service";

/**
 * Gateway temps réel (Socket.io, MÊME port que l'API REST — pas de nouveau port).
 * Isolation multi-tenant : le périmètre du client est résolu à la connexion
 * (JWT Supabase) et le filtrage se fait À LA SOURCE (émission), jamais côté client.
 */
@WebSocketGateway({ cors: { origin: "*" } })
export class PositionsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger(PositionsGateway.name);
  private readonly subs = new Map<string, Subscription>();

  constructor(
    private readonly realtime: TraccarRealtimeService,
    private readonly supa: SupabaseService,
    private readonly access: AccessService,
    private readonly vehicles: VehiclesService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const raw =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization as string | undefined);
    const user = await this.supa.getUserFromToken(raw);
    if (!user) {
      socket.disconnect(true);
      return;
    }

    const allowed = await this.access.allowed(user.id);

    // snapshot initial (best-effort : vide si Traccar injoignable)
    try {
      socket.emit("snapshot", await this.vehicles.list(user.id));
    } catch {
      socket.emit("snapshot", []);
    }

    // flux temps réel filtré au périmètre du client
    const sub = this.realtime.positions$.subscribe((batch) => {
      const mine = batch.filter((v) => allowed.imeis.has(v.imei));
      if (mine.length) socket.emit("positions", mine);
    });
    this.subs.set(socket.id, sub);
    this.log.debug(`client temps réel connecté (${allowed.imeis.size} véhicules)`);
  }

  handleDisconnect(socket: Socket): void {
    this.subs.get(socket.id)?.unsubscribe();
    this.subs.delete(socket.id);
  }
}
