import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Socket } from "socket.io";
import type { Subscription } from "rxjs";
import { SupabaseService } from "../supabase/supabase.service";
import { AccessService, type AllowedSet } from "../supabase/access.service";
import { VehiclesService } from "../vehicles/vehicles.service";
import { TraccarRealtimeService } from "./traccar-realtime.service";

const ALLOWED_REFRESH_MS = 60_000; // re-résolution du périmètre toutes les 60 s

type ClientState = { sub: Subscription; interval: NodeJS.Timeout; userId: string; allowed: AllowedSet };

/**
 * Gateway temps réel (Socket.io, même port que l'API REST).
 * Isolation à la source : périmètre du client résolu à la connexion, puis
 * RE-RÉSOLU périodiquement (60 s) + sur event `refresh` (ex. après un partage
 * reçu) — évite qu'un nouveau véhicule partagé n'apparaisse qu'à la reco.
 */
@WebSocketGateway({ cors: { origin: "*" } })
export class PositionsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger(PositionsGateway.name);
  private readonly clients = new Map<string, ClientState>();

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

    // état mutable par socket : le filtrage lit toujours le périmètre courant
    const state: ClientState = {
      userId: user.id,
      allowed: await this.access.allowed(user.id),
      sub: undefined as unknown as Subscription,
      interval: undefined as unknown as NodeJS.Timeout,
    };

    try {
      socket.emit("snapshot", await this.vehicles.list(user.id));
    } catch {
      socket.emit("snapshot", []);
    }

    state.sub = this.realtime.positions$.subscribe((batch) => {
      const mine = batch.filter((v) => state.allowed.imeis.has(v.imei));
      if (mine.length) socket.emit("positions", mine);
    });

    state.interval = setInterval(() => {
      void this.reresolve(state);
    }, ALLOWED_REFRESH_MS);

    this.clients.set(socket.id, state);
    this.log.debug(`client temps réel connecté (${state.allowed.imeis.size} véhicules)`);
  }

  /** Le client peut demander une re-résolution immédiate (ex. après un claim de partage). */
  @SubscribeMessage("refresh")
  async onRefresh(socket: Socket): Promise<void> {
    const state = this.clients.get(socket.id);
    if (!state) return;
    await this.reresolve(state);
    try {
      socket.emit("snapshot", await this.vehicles.list(state.userId));
    } catch {
      /* best-effort */
    }
  }

  private async reresolve(state: ClientState): Promise<void> {
    try {
      state.allowed = await this.access.allowed(state.userId);
    } catch {
      /* garde l'ancien périmètre si Supabase indisponible */
    }
  }

  handleDisconnect(socket: Socket): void {
    const state = this.clients.get(socket.id);
    if (state) {
      state.sub.unsubscribe();
      clearInterval(state.interval);
      this.clients.delete(socket.id);
    }
  }
}
