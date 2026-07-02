/** Miroirs des VMs alarmes de l'API façade (§6.3 / §6.4). */
export interface AlarmEventVM {
  type: string;
  vehicle: string;
  time: string;
  detail: string;
  statusText: string;
  speed: number;
  dt: string;
  addr: string | null;
  lat: string | null;
  lng: string | null;
}

export type HealthStatus = "ok" | "check" | "problem";

export interface DeviceAnomaly {
  type: string;
  cause: string;
  action: string;
}

export interface DeviceHealthVM {
  vehicle: string;
  status: HealthStatus;
  anomalies: DeviceAnomaly[];
}

export interface NotificationPrefs {
  armed: boolean;
  types: Record<string, boolean>;
}
