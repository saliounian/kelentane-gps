import { API_URL } from "../config/env";
import { ApiError } from "./api";
import { authHeader } from "./authHeader";
import type { AlarmEventVM, DeviceHealthVM, NotificationPrefs } from "../types/alarm";

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

export const fetchAlarmEvents = () => getJson<AlarmEventVM[]>("/alarms/events");
export const fetchAnomalies = () => getJson<DeviceHealthVM[]>("/alarms/anomalies");
export const fetchPrefs = () => getJson<NotificationPrefs>("/notification-prefs");

export async function patchPrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/notification-prefs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(patch),
    });
  } catch (e) {
    throw new ApiError((e as Error).message || "Réseau indisponible");
  }
  if (!res.ok) throw new ApiError(`Erreur ${res.status}`, res.status);
  return (await res.json()) as NotificationPrefs;
}

/** Enregistre un jeton push côté API (envoi réel différé). */
export async function registerPushToken(token: string, platform: string): Promise<void> {
  try {
    await fetch(`${API_URL}/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform }),
    });
  } catch {
    /* best-effort */
  }
}
