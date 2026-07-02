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
