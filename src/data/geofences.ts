import { API_URL } from "../config/env";
import { ApiError } from "./api";
import type { CreateGeofenceBody, GeofenceVM } from "../types/geofence";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    throw new ApiError((e as Error).message || "Réseau indisponible");
  }
  if (!res.ok) throw new ApiError(res.status === 502 ? "Cœur GPS injoignable" : `Erreur ${res.status}`, res.status);
  return (await res.json()) as T;
}

export const fetchGeofences = (id: number) => req<GeofenceVM[]>(`/vehicles/${id}/geofences`);

export const createGeofence = (id: number, body: CreateGeofenceBody) =>
  req<GeofenceVM>(`/vehicles/${id}/geofences`, { method: "POST", body: JSON.stringify(body) });

export const patchGeofence = (gid: string, body: { enabled?: boolean; name?: string }) =>
  req<GeofenceVM>(`/geofences/${gid}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteGeofence = (gid: string) =>
  req<{ deleted: true }>(`/geofences/${gid}`, { method: "DELETE" });
