import { request } from "./api";
import type { CreateGeofenceBody, GeofenceVM } from "../types/geofence";

export const fetchGeofences = (id: number) => request<GeofenceVM[]>(`/vehicles/${id}/geofences`);

export const createGeofence = (id: number, body: CreateGeofenceBody) =>
  request<GeofenceVM>(`/vehicles/${id}/geofences`, { method: "POST", body });

export const patchGeofence = (gid: string, body: { enabled?: boolean; name?: string }) =>
  request<GeofenceVM>(`/geofences/${gid}`, { method: "PATCH", body });

export const deleteGeofence = (gid: string) =>
  request<{ deleted: true }>(`/geofences/${gid}`, { method: "DELETE" });
