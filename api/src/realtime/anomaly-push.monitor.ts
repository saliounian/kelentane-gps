import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AlarmsService } from "../alarms/alarms.service";
import { TraccarService } from "../traccar/traccar.service";
import { PushService } from "../notifications/push.service";
import { AlarmRecipientsService } from "./alarm-recipients.service";
import type { TraccarPosition } from "../traccar/traccar.types";

/**
 * Titres des ANOMALIES du menu Alarmes (ids ALARM_TYPES côté app).
 * `sim` n'a PAS de signal distinct côté Traccar : un forfait épuisé se présente
 * exactement comme un boîtier hors ligne — il est donc couvert par `disconnect`
 * (dont la cause mentionne la SIM). Documenté pour qu'aucun type ne soit
 * silencieusement « oublié ».
 */
const ANOMALY_TITLE: Record<string, string> = {
  disconnect: "Déconnexion prolongée",
  late: "Données en retard",
  power: "Alimentation coupée",
  battery: "Tension batterie faible",
  gsm: "Signal GSM faible",
  gps_lost: "Perte du signal GPS",
};

/** Intervalle d'évaluation (défaut 5 min). Surchargable par ANOMALY_SCAN_MS. */
const DEFAULT_SCAN_MS = 5 * 60 * 1000;

/**
 * Moniteur d'ANOMALIES → push. Les anomalies de santé dispositif (§6.4) sont
 * dérivées d'un ÉTAT, pas d'un événement Traccar ponctuel : sans ce moniteur,
 * aucun type `late`/`gsm`/`gps_lost`/`power`/`battery`/`disconnect` calculé ne
 * déclencherait jamais de notification.
 *
 * Déclenchement en FRONT MONTANT uniquement : une anomalie déjà notifiée n'est pas
 * renvoyée tant qu'elle n'a pas disparu puis réapparu — sinon un boîtier hors ligne
 * notifierait à chaque scan. L'état vit en mémoire (redémarrage API = re-notification
 * unique des anomalies encore présentes, acceptable).
 *
 * Respecte les préférences utilisateur : `PushService.sendToUser` filtre sur `armed`
 * et sur le toggle du type. Inactif si PUSH_ENABLED=false.
 */
@Injectable()
export class AnomalyPushMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AnomalyPushMonitor.name);
  private timer?: ReturnType<typeof setInterval>;
  private readonly scanMs: number;
  /** Anomalies déjà notifiées, par IMEI → set de types (anti-répétition). */
  private readonly active = new Map<string, Set<string>>();

  constructor(
    private readonly traccar: TraccarService,
    private readonly alarms: AlarmsService,
    private readonly push: PushService,
    private readonly recipients: AlarmRecipientsService,
    config: ConfigService,
  ) {
    const raw = Number(config.get<string>("ANOMALY_SCAN_MS"));
    this.scanMs = Number.isFinite(raw) && raw >= 30000 ? raw : DEFAULT_SCAN_MS;
  }

  onModuleInit(): void {
    if (!this.push.isEnabled) {
      this.log.log("PUSH_ENABLED=false → moniteur d'anomalies inactif.");
      return;
    }
    this.timer = setInterval(() => void this.scan(), this.scanMs);
    this.log.log(`Moniteur d'anomalies push actif (scan ${Math.round(this.scanMs / 1000)} s).`);
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Un passage : santé de toute la flotte, push sur les anomalies NOUVELLES. */
  private async scan(): Promise<void> {
    let devices: Awaited<ReturnType<TraccarService["getFleet"]>>["devices"];
    let positions: TraccarPosition[];
    try {
      ({ devices, positions } = await this.traccar.getFleet());
    } catch (e) {
      this.log.warn(`scan anomalies — Traccar injoignable: ${(e as Error).message}`);
      return;
    }
    const posBy = new Map<number, TraccarPosition>();
    for (const p of positions) posBy.set(p.deviceId, p);
    const now = new Date();

    for (const d of devices) {
      const imei = d.uniqueId;
      const health = this.alarms.health(d, posBy.get(d.id), now);
      const current = new Set(health.anomalies.map((a) => a.type));
      const seen = this.active.get(imei) ?? new Set<string>();

      const fresh = health.anomalies.filter((a) => !seen.has(a.type));
      this.active.set(imei, current); // état à jour même si l'envoi échoue partiellement
      if (fresh.length === 0) continue;

      const userIds = await this.recipients.usersForImei(imei);
      if (userIds.length === 0) continue;
      for (const uid of userIds) {
        for (const a of fresh) {
          try {
            await this.push.sendToUser(uid, {
              title: ANOMALY_TITLE[a.type] ?? "Anomalie dispositif",
              body: `${d.name} — ${a.cause}`,
              type: a.type,
              data: { imei, alarmType: a.type, action: a.action },
            });
          } catch (e) {
            this.log.error(`push anomalie ${a.type} ${uid} (${imei}): ${(e as Error).message}`);
          }
        }
      }
    }
  }
}
