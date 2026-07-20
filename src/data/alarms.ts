import { request } from "./api";
import type { AlarmEventVM, DeviceHealthVM, NotificationPrefs } from "../types/alarm";

export const fetchAlarmEvents = () => request<AlarmEventVM[]>("/alarms/events");
export const fetchAnomalies = () => request<DeviceHealthVM[]>("/alarms/anomalies");
export const fetchPrefs = () => request<NotificationPrefs>("/notification-prefs");

export const patchPrefs = (patch: Partial<NotificationPrefs>) =>
  request<NotificationPrefs>("/notification-prefs", { method: "PATCH", body: patch });

/** Enregistre un jeton push côté API (best-effort : un échec ne bloque rien). */
export async function registerPushToken(token: string, platform: string): Promise<void> {
  try {
    await request<void>("/push/register", { method: "POST", body: { token, platform } });
  } catch {
    /* best-effort — déjà journalisé par le client réseau */
  }
}
