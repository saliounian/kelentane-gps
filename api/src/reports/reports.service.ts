import { Injectable, NotFoundException } from "@nestjs/common";
import { TraccarService } from "../traccar/traccar.service";
import type { TraccarSummary } from "../traccar/traccar.types";
import type { DayKm, KmReport, RoutePoint, StatsReport } from "./reports.types";

const KMH = 1.852; // nœuds → km/h
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(private readonly traccar: TraccarService) {}

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

  async km(deviceId: number, range: { from: string; to: string }): Promise<KmReport> {
    const { devices } = await this.traccar.getFleet();
    if (!devices.some((d) => d.id === deviceId)) throw new NotFoundException("Véhicule introuvable");

    const daily = await this.traccar.getSummary([deviceId], range.from, range.to, true);
    const days = this.bucketDays(range.from, range.to, daily);
    const total = Math.round(days.reduce((a, d) => a + d.km, 0));
    const avgPerDay = days.length ? Math.round(total / days.length) : 0;

    const all = await this.traccar.getSummary(devices.map((d) => d.id), range.from, range.to, false);
    const totalBy = new Map<number, number>();
    for (const s of all) totalBy.set(s.deviceId, (totalBy.get(s.deviceId) ?? 0) + s.distance);
    const byVehicle = devices.map((d) => ({
      id: d.id,
      name: d.name,
      total: Math.round((totalBy.get(d.id) ?? 0) / 1000),
    }));

    return { range, days, total, avgPerDay, byVehicle };
  }

  async stats(deviceId: number, range: { from: string; to: string }): Promise<StatsReport> {
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

  async route(deviceId: number, from: string, to: string): Promise<RoutePoint[]> {
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
