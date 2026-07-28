import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TraccarService } from "../traccar/traccar.service";
import { AccessService } from "../supabase/access.service";
import type { TraccarSummary } from "../traccar/traccar.types";
import type { DayKm, KmReport, RoutePoint, StatsReport, StopPoint } from "./reports.types";

const KMH = 1.852; // nœuds → km/h
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Durée minimale d'un arrêt affiché (2 min). Traccar calcule les arrêts avec son
 * propre seuil serveur `report.trips.minimalParkingDuration` (défaut 300 s = 5 min),
 * NON réglable par requête. Ce plancher API n'écarte que les arrêts trop courts si
 * Traccar est plus permissif ; pour réellement capturer les arrêts de 2–5 min, il
 * faut baisser `minimalParkingDuration` à 120 s côté serveur Traccar (voir README/rapport).
 */
const MIN_STOP_MS = 120_000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly traccar: TraccarService,
    private readonly access: AccessService,
  ) {}

  /** Vérifie que le client a accès à ce véhicule (via IMEI). */
  private async assertAccess(userId: string, deviceId: number): Promise<void> {
    const devices = await this.traccar.getDevices();
    const d = devices.find((x) => x.id === deviceId);
    if (!d) throw new NotFoundException("Véhicule introuvable");
    const allowed = await this.access.allowed(userId);
    if (!allowed.imeis.has(d.uniqueId)) throw new ForbiddenException("Accès refusé à ce véhicule");
  }

  /** Résout un intervalle (7d/30d/custom) en bornes ISO alignées aux jours. */
  resolveRange(range?: string, from?: string, to?: string): { from: string; to: string } {
    if (range === "custom" && from && to) {
      return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
    }
    const days = range === "30d" ? 30 : 7;
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * DAY_MS);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  async km(deviceId: number, range: { from: string; to: string }, userId: string): Promise<KmReport> {
    const { devices } = await this.traccar.getFleet();
    const target = devices.find((d) => d.id === deviceId);
    if (!target) throw new NotFoundException("Véhicule introuvable");
    const allowed = await this.access.allowed(userId);
    if (!allowed.imeis.has(target.uniqueId)) throw new ForbiddenException("Accès refusé à ce véhicule");

    const daily = await this.traccar.getSummary([deviceId], range.from, range.to, true);
    const days = this.bucketDays(range.from, range.to, daily);
    const total = Math.round(days.reduce((a, d) => a + d.km, 0));
    const avgPerDay = days.length ? Math.round(total / days.length) : 0;

    // « total par véhicule » borné au périmètre du client (pas toute la flotte).
    const visible = devices.filter((d) => allowed.imeis.has(d.uniqueId));
    const all = await this.traccar.getSummary(visible.map((d) => d.id), range.from, range.to, false);
    const totalBy = new Map<number, number>();
    for (const s of all) totalBy.set(s.deviceId, (totalBy.get(s.deviceId) ?? 0) + s.distance);
    const byVehicle = visible.map((d) => ({
      id: d.id,
      name: d.name,
      total: Math.round((totalBy.get(d.id) ?? 0) / 1000),
    }));

    return { range, days, total, avgPerDay, byVehicle };
  }

  async stats(deviceId: number, range: { from: string; to: string }, userId: string): Promise<StatsReport> {
    await this.assertAccess(userId, deviceId);
    const { devices } = await this.traccar.getFleet();
    if (!devices.some((d) => d.id === deviceId)) throw new NotFoundException("Véhicule introuvable");

    const [daily, summary, trips, stops, events] = await Promise.all([
      this.traccar.getSummary([deviceId], range.from, range.to, true),
      this.traccar.getSummary([deviceId], range.from, range.to, false),
      this.traccar.getTrips(deviceId, range.from, range.to),
      this.traccar.getStops(deviceId, range.from, range.to),
      this.traccar.getEvents([deviceId], range.from, range.to),
    ]);

    const days = this.bucketDays(range.from, range.to, daily);
    const total = Math.round(days.reduce((a, d) => a + d.km, 0));
    const avgPerDay = days.length ? Math.round(total / days.length) : 0;
    const maxDay = days.reduce((m, d) => Math.max(m, d.km), 0);

    const s = summary[0];
    const driveMs = trips.reduce((a, t) => a + t.duration, 0);
    const idleMs = stops.reduce((a, st) => a + st.duration, 0);
    const over = events.filter((e) => e.type === "deviceOverspeed").length;
    const daysActive = days.filter((d) => d.km > 0).length;

    return {
      days,
      total,
      avgPerDay,
      maxDay,
      activity: {
        drive: this.fmtDur(driveMs),
        idle: this.fmtDur(idleMs),
        trips: trips.length,
        stops: stops.length,
        avg: s ? Math.round(s.averageSpeed * KMH) : 0,
        max: s ? Math.round(s.maxSpeed * KMH) : 0,
        over,
        days: daysActive,
      },
    };
  }

  async route(deviceId: number, from: string, to: string, userId: string): Promise<RoutePoint[]> {
    await this.assertAccess(userId, deviceId);
    const positions = await this.traccar.getRoute(deviceId, from, to);
    return positions.map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      speed: Math.round(p.speed * KMH),
      course: Math.round(p.course),
      time: p.fixTime,
      addr: p.address ?? null,
    }));
  }

  /**
   * Arrêts (stationnements) — proxy du rapport ReportStops natif de Traccar
   * (`GET /api/reports/stops`). Même contrôle d'accès que les autres rapports.
   * Filtre les arrêts < 2 min (MIN_STOP_MS) et normalise en StopPoint.
   */
  async stops(deviceId: number, range: { from: string; to: string }, userId: string): Promise<StopPoint[]> {
    await this.assertAccess(userId, deviceId);
    const raw = await this.traccar.getStops(deviceId, range.from, range.to);
    return raw
      .filter((s) => s.duration >= MIN_STOP_MS)
      .map((s) => ({
        latitude: s.latitude ?? 0,
        longitude: s.longitude ?? 0,
        address: s.address ?? null,
        startTime: s.startTime,
        endTime: s.endTime ?? null,
        duration: s.duration,
      }));
  }

  /** Séquence de jours [from..to] avec km, en zippant les résumés daily par date. */
  private bucketDays(fromIso: string, toIso: string, daily: TraccarSummary[]): DayKm[] {
    const kmByDate = new Map<string, number>();
    for (const s of daily) {
      const d = s.startTime ? this.dateKey(new Date(s.startTime)) : null;
      if (d) kmByDate.set(d, (kmByDate.get(d) ?? 0) + s.distance / 1000);
    }
    const out: DayKm[] = [];
    const start = new Date(fromIso);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toIso);
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + DAY_MS)) {
      const key = this.dateKey(d);
      out.push({ date: key, km: Math.round(kmByDate.get(key) ?? 0) });
    }
    return out;
  }

  private dateKey(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  private fmtDur(ms: number): string {
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h} h ${String(m).padStart(2, "0")}`;
  }
}
