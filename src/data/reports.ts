import { request } from "./api";
import type { KmReport, RoutePoint, StatsReport, StopPoint } from "../types/reports";

export type Range = "7d" | "30d" | "custom";

export function fetchKm(id: number, range: Range, from?: string, to?: string): Promise<KmReport> {
  const q = new URLSearchParams({ range });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return request<KmReport>(`/vehicles/${id}/km?${q.toString()}`);
}

export function fetchStats(id: number, range: Range = "7d", from?: string, to?: string): Promise<StatsReport> {
  const q = new URLSearchParams({ range });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return request<StatsReport>(`/vehicles/${id}/stats?${q.toString()}`);
}

export function fetchRoute(id: number, from?: string, to?: string): Promise<RoutePoint[]> {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return request<RoutePoint[]>(`/vehicles/${id}/route?${q.toString()}`);
}

/** Arrêts (stationnements) sur la période — proxy du rapport ReportStops de Traccar. */
export function fetchStops(id: number, from?: string, to?: string): Promise<StopPoint[]> {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return request<StopPoint[]>(`/vehicles/${id}/stops?${q.toString()}`);
}
