/**
 * View-model véhicule (handoff §6.1 / §10) — forme renvoyée telle quelle au
 * mobile, pour éviter tout remapping côté client.
 */
export type VehicleStatus = "moving" | "online" | "parked" | "offline";

export interface VehicleVM {
  id: number; // = Traccar device id
  imei: string;
  name: string;
  status: VehicleStatus;
  color: string; // dérivé du statut (ONLINE/PARKED/OFFLINE)
  speed: number; // km/h
  lat: string | null;
  lng: string | null;
  addr: string | null;
  signal: "GPS" | "LBS";
  battery: number | null; // % batterie interne boîtier
  voltage: number | null; // tension véhicule (V)
  acc: boolean | null; // contact (ignition)
  sats: number | null;
  gsm: number | null; // qualité GSM brute (Traccar rssi)
  odo: number | null; // km
  heading: number | null; // cap degrés
  model: string | null;
  lastSeen: string | null; // ISO
  // Champs métier (viennent de la base app, null tant que non joints)
  plate: string | null;
  type: string | null;
  sim: string | null;
  phone: string | null;
  iccid: string | null;
  owner: string | null;
  iconKey: string | null;
}
