import { request } from "./api";
import type { KmReport, RoutePoint, StatsReport } from "../types/reports";

export type Range = "7d" | "30d" | "custom";

export function fetchKm(id: number, range: Range, from?: string, to?: string): Promise<KmReport> {
  const q = new URLSearchParams({ range });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return request<KmReport>(`/vehicles/${id}/km?${q.toString()}`);
}

export function fetchStats(id: number, range: Range = "7d"): Promise<StatsReport> {
  return request<StatsReport>(`/vehicles/${id}/stats?range=${range}`);
}

export function fetchRoute(id: number, from?: string, to?: string): Promise<RoutePoint[]> {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return request<RoutePoint[]>(`/vehicles/${id}/route?${q.toString()}`);
}
