import { Injectable } from "@nestjs/common";
import { TraccarService } from "../traccar/traccar.service";
import { AccessService } from "../supabase/access.service";
import type { TraccarDevice, TraccarEvent, TraccarPosition } from "../traccar/traccar.types";
import type { AlarmEventVM, DeviceAnomaly, DeviceHealthVM, HealthStatus } from "./alarms.types";

// Mapping type d'événement Traccar → id ALARM_TYPES (catégorie « event »).
const EVENT_TYPE: Record<string, string> = {
  geofenceExit: "geo_out",
  geofenceEnter: "geo_in",
  deviceOverspeed: "speed",
  ignitionOn: "ignition",
};
const EVENT_LABEL: Record<string, string> = {
  geo_out: "Sortie de géofence",
  geo_in: "Entrée de géofence",
  speed: "Excès de vitesse",
  tow: "Alarme de déplacement",
  ignition: "Démarrage moteur",
  hours: "Déplacement hors horaires",
};
// alarmes matérielles (attributes.alarm) qui restent des événements
const HW_EVENT_ALARM: Record<string, string> = { tow: "tow", sos: "tow", movement: "tow" };

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AlarmsService {
  constructor(
    private readonly traccar: TraccarService,
    private readonly access: AccessService,
  ) {}

  /** Événements récents (24 h) → AlarmEventVM. FILTRÉ au périmètre du client. */
  async events(userId: string, now: Date = new Date()): Promise<AlarmEventVM[]> {
    const allowed = await this.access.allowed(userId);
    const fleet = await this.traccar.getFleet();
    const devices = fleet.devices.filter((d) => allowed.imeis.has(d.uniqueId));
    const posBy = new Map<number, TraccarPosition>();
    for (const p of fleet.positions) posBy.set(p.deviceId, p);
    const nameBy = new Map<number, string>();
    for (const d of devices) nameBy.set(d.id, d.name);

    const from = new Date(now.getTime() - DAY_MS).toISOString();
    const evs = await this.traccar.getEvents(devices.map((d) => d.id), from, now.toISOString());

    const out: AlarmEventVM[] = [];
    for (const e of evs) {
      const id = this.eventId(e);
      if (!id) continue;
      const pos = posBy.get(e.deviceId);
      const dt = new Date(e.eventTime);
      out.push({
        type: id,
        vehicle: nameBy.get(e.deviceId) ?? `#${e.deviceId}`,
        time: this.hhmm(dt),
        detail: this.detail(id, e, pos),
        statusText: EVENT_LABEL[id] ?? id,
        speed: typeof e.attributes.speed === "number" ? Math.round(e.attributes.speed) : (pos ? Math.round(pos.speed * 1.852) : 0),
        dt: this.fmt(dt),
        addr: pos?.address ?? null,
        lat: pos ? String(pos.latitude) : null,
        lng: pos ? String(pos.longitude) : null,
      });
    }
    return out.sort((a, b) => (a.dt < b.dt ? 1 : -1));
  }

  /** Santé dispositif calculée (§6.4). FILTRÉ au périmètre du client. */
  async anomalies(userId: string, now: Date = new Date()): Promise<DeviceHealthVM[]> {
    const allowed = await this.access.allowed(userId);
    const { devices, positions } = await this.traccar.getFleet();
    const posBy = new Map<number, TraccarPosition>();
    for (const p of positions) posBy.set(p.deviceId, p);
    return devices.filter((d) => allowed.imeis.has(d.uniqueId)).map((d) => this.health(d, posBy.get(d.id), now));
  }

  private eventId(e: TraccarEvent): string | null {
    if (e.type === "alarm") {
      const a = e.attributes.alarm ?? "";
      return HW_EVENT_ALARM[a] ?? null; // powerCut/lowBattery = anomalies, pas ici
    }
    return EVENT_TYPE[e.type] ?? null;
  }

  private detail(id: string, e: TraccarEvent, pos: TraccarPosition | undefined): string {
    if (id === "speed") {
      const s = typeof e.attributes.speed === "number" ? Math.round(e.attributes.speed) : pos ? Math.round(pos.speed * 1.852) : 0;
      return `${s} km/h`;
    }
    if (id === "tow") return "Déplacé moteur éteint (remorquage ?)";
    return pos?.address ?? "—";
  }

  private health(d: TraccarDevice, pos: TraccarPosition | undefined, now: Date): DeviceHealthVM {
    const a = pos?.attributes ?? {};
    const last = d.lastUpdate ? new Date(d.lastUpdate).getTime() : 0;
    const ageMs = last ? now.getTime() - last : Infinity;
    const anomalies: DeviceAnomaly[] = [];

    if (ageMs > 3 * DAY_MS) {
      anomalies.push({ type: "disconnect", cause: "Aucun signal depuis plusieurs jours. SIM expirée ou forfait data épuisé.", action: "Recharger le forfait de la SIM" });
    } else if (ageMs > 10 * 60 * 1000) {
      anomalies.push({ type: "late", cause: "Dernières données reçues il y a plus de 10 minutes.", action: "Vérifier la couverture réseau" });
    }
    if (a.charge === false || a.power === 0) {
      anomalies.push({ type: "power", cause: "Le GPS ne reçoit plus de courant du véhicule.", action: "Vérifier le branchement / le fusible" });
    }
    if (typeof a.battery === "number" && a.battery < 20) {
      anomalies.push({ type: "battery", cause: `Batterie interne faible (${a.battery} %).`, action: "Contrôler l'alimentation" });
    }
    if (typeof a.rssi === "number" && a.rssi <= 1) {
      anomalies.push({ type: "gsm", cause: "Signal GSM très faible.", action: "Vérifier l'antenne / la zone" });
    }
    if (pos && !pos.valid) {
      anomalies.push({ type: "gps_lost", cause: "Pas de point GPS valide (position approximative LBS).", action: "Vérifier l'antenne GPS" });
    }

    const critical = anomalies.some((x) => x.type === "disconnect" || x.type === "power");
    const status: HealthStatus = critical ? "problem" : anomalies.length ? "check" : "ok";
    return { vehicle: d.name, status, anomalies };
  }

  private hhmm(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  private fmt(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}
