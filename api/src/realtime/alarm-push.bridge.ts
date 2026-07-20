import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { Subscription } from "rxjs";
import { PushService } from "../notifications/push.service";
import { AlarmRecipientsService } from "./alarm-recipients.service";
import { TraccarRealtimeService, type AlarmEvent } from "./traccar-realtime.service";

/**
 * Mapping event Traccar → id d'alarme (clé des préférences ALARM_TYPES) + libellés FR.
 * Retourne null pour les types non pris en charge (ignorés).
 *
 * Couvre TOUS les types d'ÉVÉNEMENT du menu Alarmes que Traccar émet en temps réel :
 *  geo_in / geo_out / speed / ignition (démarrage) / tow / power / battery / disconnect,
 *  plus `hours` (déplacement hors horaires) dérivé d'un démarrage/mouvement survenu
 *  dans la fenêtre de nuit (voir NIGHT_FROM_H / NIGHT_TO_H).
 *
 * Les ANOMALIES d'ÉTAT (`sim`, `gsm`, `gps_lost`, `late`, et `power`/`battery`/
 * `disconnect` quand ils viennent de la santé dispositif §6.4 plutôt que d'un
 * événement) ne transitent pas par ce flux : elles sont poussées par
 * `AnomalyPushMonitor`, qui les évalue périodiquement en front montant.
 */

/**
 * Fenêtre « hors horaires » (heure locale du serveur — Dakar UTC+0) : tout
 * démarrage/mouvement entre 22 h et 5 h déclenche `hours` EN PLUS de l'événement
 * d'origine. Constantes ajustables ici tant qu'une plage par utilisateur n'existe
 * pas côté préférences (dette assumée, documentée dans le récap de lot).
 */
const NIGHT_FROM_H = 22;
const NIGHT_TO_H = 5;

/** Vrai si l'horodatage de l'événement tombe dans la fenêtre de nuit. */
function isOutsideHours(iso: string): boolean {
  const h = new Date(iso).getHours();
  return h >= NIGHT_FROM_H || h < NIGHT_TO_H;
}

/** Événement `hours` dérivé : mouvement constaté hors horaires. */
function describeHours(ev: AlarmEvent): { type: string; title: string; body: string } | null {
  const t = ev.event.type;
  const moving = t === "ignitionOn" || t === "deviceMoving" || ev.event.attributes?.alarm === "movement";
  if (!moving || !isOutsideHours(ev.event.eventTime)) return null;
  return { type: "hours", title: "Déplacement hors horaires", body: `${ev.deviceName} bouge en dehors des horaires habituels.` };
}
function describe(ev: AlarmEvent): { type: string; title: string; body: string } | null {
  const name = ev.deviceName;
  const et = ev.event.type;
  switch (et) {
    case "geofenceEnter":
      return { type: "geo_in", title: "Entrée de géofence", body: `${name} est entré dans une zone.` };
    case "geofenceExit":
      return { type: "geo_out", title: "Sortie de géofence", body: `${name} est sorti d'une zone.` };
    case "deviceOverspeed": {
      const s = ev.event.attributes?.speed;
      const kmh = typeof s === "number" ? ` (${Math.round(s * 1.852)} km/h)` : ""; // Traccar = nœuds
      return { type: "speed", title: "Excès de vitesse", body: `${name} — excès de vitesse${kmh}.` };
    }
    case "ignitionOn":
      return { type: "ignition", title: "Démarrage moteur", body: `${name} — moteur démarré.` };
    case "deviceOffline":
      return { type: "disconnect", title: "Déconnexion prolongée", body: `${name} — dispositif hors ligne.` };
    case "alarm":
      return describeAlarm(ev.event.attributes?.alarm, name);
    default:
      return null;
  }
}

/** Sous-type d'alarme Traccar (`attributes.alarm`) → id d'alarme du menu + libellé FR. */
function describeAlarm(alarm: string | undefined, name: string): { type: string; title: string; body: string } | null {
  switch (alarm) {
    case "tow":
    case "movement":
      return { type: "tow", title: "Mouvement sans contact", body: `${name} bouge sans contact.` };
    case "powerCut":
    case "powerOff":
      return { type: "power", title: "Alimentation coupée", body: `${name} — alimentation coupée.` };
    case "lowBattery":
    case "lowPower":
      return { type: "battery", title: "Tension batterie faible", body: `${name} — batterie faible.` };
    default:
      return null; // sos, autres alarmes hors menu → ignorées (pas de préférence dédiée)
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
    private readonly recipients: AlarmRecipientsService,
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
    // Un même événement peut produire DEUX notifications de types différents
    // (ex. démarrage moteur à 23 h → `ignition` + `hours`) : chacune reste soumise
    // à sa propre préférence utilisateur côté PushService.
    const descs = [describe(ev), describeHours(ev)].filter((d): d is { type: string; title: string; body: string } => d !== null);
    if (descs.length === 0) return; // type non géré
    const userIds = await this.recipients.usersForImei(ev.imei);
    for (const uid of userIds) {
      for (const desc of descs) {
        try {
          await this.push.sendToUser(uid, {
            title: desc.title,
            body: desc.body,
            type: desc.type,
            data: { imei: ev.imei, eventType: ev.event.type, alarmType: desc.type },
          });
        } catch (e) {
          this.log.error(`push ${uid} (${ev.imei}): ${(e as Error).message}`);
        }
      }
    }
  }
}
