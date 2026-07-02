/** View-model véhicule côté mobile — miroir exact de l'API façade (§6.1 / §10). */
export type VehicleStatus = "moving" | "online" | "parked" | "offline";

export interface VehicleVM {
  id: number;
  imei: string;
  name: string;
  status: VehicleStatus;
  color: string;
  speed: number;
  lat: string | null;
  lng: string | null;
  addr: string | null;
  signal: "GPS" | "LBS";
  battery: number | null;
  voltage: number | null;
  acc: boolean | null;
  sats: number | null;
  gsm: number | null;
  odo: number | null;
  heading: number | null;
  model: string | null;
  lastSeen: string | null;
  plate: string | null;
  type: string | null;
  sim: string | null;
  phone: string | null;
  iccid: string | null;
  owner: string | null;
  iconKey: string | null;
}
