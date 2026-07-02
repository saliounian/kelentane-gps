/** Formes minimales renvoyées par l'API Traccar (cœur GPS, jamais exposé au mobile). */

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string; // = IMEI
  status: "online" | "offline" | "unknown";
  lastUpdate: string | null; // ISO
  positionId?: number;
  model?: string | null;
  phone?: string | null;
  contact?: string | null;
  category?: string | null;
}

export interface TraccarEvent {
  id: number;
  type: string; // deviceOverspeed | geofenceEnter | geofenceExit | ignitionOn | alarm | ...
  eventTime: string; // ISO
  deviceId: number;
  positionId?: number;
  geofenceId?: number;
  attributes: {
    alarm?: string; // tow | sos | powerCut | lowBattery ...
    speed?: number;
    [k: string]: unknown;
  };
}

export interface TraccarSummary {
  deviceId: number;
  deviceName: string;
  distance: number; // mètres
  averageSpeed: number; // nœuds
  maxSpeed: number; // nœuds
  engineHours: number; // ms
  startTime?: string; // ISO (présent en daily)
}

export interface TraccarTrip {
  deviceId: number;
  distance: number; // mètres
  averageSpeed: number; // nœuds
  maxSpeed: number; // nœuds
  duration: number; // ms
  startTime: string;
  endTime: string;
}

export interface TraccarStop {
  deviceId: number;
  duration: number; // ms
  startTime: string;
  address?: string | null;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number; // nœuds
  course: number; // cap en degrés
  address?: string | null;
  fixTime: string;
  valid: boolean;
  attributes: {
    battery?: number; // % batterie interne
    power?: number; // tension véhicule (V)
    voltage?: number;
    ignition?: boolean; // ACC
    sat?: number; // satellites
    rssi?: number; // signal GSM
    odometer?: number; // m
    totalDistance?: number;
    distance?: number;
    blocked?: boolean;
    alarm?: string;
    [k: string]: unknown;
  };
}
