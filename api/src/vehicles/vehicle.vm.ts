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
  charge: boolean | null; // batterie en charge (véhicule alimente le boîtier)
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
  ownerId: string | null; // = clients.id propriétaire (null si device non joint / partagé)
  iconKey: string | null;
  // Accès du compte courant sur ce device (§device_access) :
  accessRole: "consultation" | "action" | null; // gating des actions
  accessStatus: "active" | "revalidate" | null; // 'revalidate' → grisé (§5)
}
