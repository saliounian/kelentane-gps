/** Événement d'alarme (§6.3) — véhicule fonctionne, simple notification. */
export interface AlarmEventVM {
  type: string; // id ALARM_TYPES (geo_out, speed, tow, ignition…)
  vehicle: string;
  time: string; // HH:MM
  detail: string;
  statusText: string;
  speed: number;
  dt: string; // YYYY-MM-DD HH:MM:SS
  addr: string | null;
  lat: string | null;
  lng: string | null;
}

export type HealthStatus = "ok" | "check" | "problem";

export interface DeviceAnomaly {
  type: string; // id ALARM_TYPES anomalie (disconnect, power, battery…)
  cause: string;
  action: string;
}

/** Santé dispositif (§6.4) — calculée, pas des événements ponctuels. */
export interface DeviceHealthVM {
  vehicle: string;
  status: HealthStatus;
  anomalies: DeviceAnomaly[];
}
