import { API_URL } from "../config/env";
import { ApiError } from "./api";
import { authHeader } from "./authHeader";
import type { KmReport, RoutePoint, StatsReport } from "../types/reports";

async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: { Accept: "application/json", ...(await authHeader()) } });
  } catch (e) {
    throw new ApiError((e as Error).message || "Réseau indisponible");
  }
  if (!res.ok) throw new ApiError(res.status === 502 ? "Cœur GPS injoignable" : `Erreur ${res.status}`, res.status);
  return (await res.json()) as T;
}

export type Range = "7d" | "30d" | "custom";

export function fetchKm(id: number, range: Range, from?: string, to?: string): Promise<KmReport> {
  const q = new URLSearchParams({ range });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return getJson<KmReport>(`/vehicles/${id}/km?${q.toString()}`);
}

export function fetchStats(id: number, range: Range = "7d"): Promise<StatsReport> {
  return getJson<StatsReport>(`/vehicles/${id}/stats?range=${range}`);
}

export function fetchRoute(id: number, from?: string, to?: string): Promise<RoutePoint[]> {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return getJson<RoutePoint[]>(`/vehicles/${id}/route?${q.toString()}`);
}
