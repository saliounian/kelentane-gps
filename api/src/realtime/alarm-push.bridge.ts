import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { Subscription } from "rxjs";
import { SupabaseService } from "../supabase/supabase.service";
import { DevicesService } from "../supabase/devices.service";
import { PushService } from "../notifications/push.service";
import { TraccarRealtimeService, type AlarmEvent } from "./traccar-realtime.service";

/**
 * Mapping event Traccar → id d'alarme (clé des préférences) + libellés FR.
 * Retourne null pour les types non pris en charge (ignorés).
 */
function describe(ev: AlarmEvent): { type: string; title: string; body: string } | null {
  const name = ev.deviceName;
  switch (ev.event.type) {
    case "geofenceEnter":
      return { type: "geo_in", title: "Entrée de géofence", body: `${name} est entré dans une zone.` };
    case "geofenceExit":
      return { type: "geo_out", title: "Sortie de géofence", body: `${name} est sorti d'une zone.` };
    case "deviceOverspeed": {
      const s = ev.event.attributes?.speed;
      const kmh = typeof s === "number" ? ` (${Math.round(s * 1.852)} km/h)` : ""; // Traccar = nœuds
      return { type: "speed", title: "Excès de vitesse", body: `${name} — excès de vitesse${kmh}.` };
    }
    case "ignitionOff":
      // Pas d'id dédié « coupure de contact » → réutilise la préf `ignition` (contact).
      return { type: "ignition", title: "Coupure de contact", body: `${name} — contact coupé.` };
    default:
      return null;
  }
}

/**
 * Pont événements Traccar → notifications push (§ moteur d'alarmes).
 * Écoute `TraccarRealtimeService.events$`, mappe l'événement, résout TOUS les
 * comptes ayant un accès ACTIF au device (device_access) et délègue à
 * PushService (qui respecte armed + préférence par type). Inactif si PUSH_ENABLED=false.
 */
@Injectable()
export class AlarmPushBridge implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AlarmPushBridge.name);
  private sub?: Subscription;

  constructor(
    private readonly realtime: TraccarRealtimeService,
    private readonly push: PushService,
    private readonly devices: DevicesService,
    private readonly supa: SupabaseService,
  ) {}

  onModuleInit(): void {
    if (!this.push.isEnabled) {
      this.log.log("PUSH_ENABLED=false → pont d'alarmes push inactif.");
      return;
    }
    this.sub = this.realtime.events$.subscribe((ev) => void this.handle(ev));
    this.log.log("Pont événements Traccar → push actif.");
  }
  onModuleDestroy(): void {
    this.sub?.unsubscribe();
  }

  private async handle(ev: AlarmEvent): Promise<void> {
    const desc = describe(ev);
    if (!desc) return; // type non géré
    const userIds = await this.usersForImei(ev.imei);
    for (const uid of userIds) {
      try {
        await this.push.sendToUser(uid, {
          title: desc.title,
          body: desc.body,
          type: desc.type,
          data: { imei: ev.imei, eventType: ev.event.type },
        });
      } catch (e) {
        this.log.error(`push ${uid} (${ev.imei}): ${(e as Error).message}`);
      }
    }
  }

  /** Tous les comptes avec accès ACTIF au device (device_access). */
  private async usersForImei(imei: string): Promise<string[]> {
    const row = await this.devices.getRowByImei(imei);
    if (!row || !this.supa.client) return [];
    const { data, error } = await this.supa.client
      .from("device_access")
      .select("user_id")
      .eq("device_id", row.id)
      .eq("status", "active");
    if (error) {
      this.log.error(`usersForImei ${imei}: ${error.message}`);
      return [];
    }
    return (data ?? []).map((r) => r.user_id as string);
  }
}
