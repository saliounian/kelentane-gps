import type { DeviceRow } from "../supabase/devices.service";
import type { TraccarDevice, TraccarPosition } from "../traccar/traccar.types";
import type { VehicleStatus, VehicleVM } from "./vehicle.vm";

const KNOTS_TO_KMH = 1.852;
const ONLINE = "#36D399";
const PARKED = "#FFB14E";
const OFFLINE = "#8E8E93";
const OFFLINE_AFTER_MS = 24 * 60 * 60 * 1000;

export function statusColor(status: VehicleStatus): string {
  switch (status) {
    case "moving":
    case "online":
      return ONLINE;
    case "parked":
      return PARKED;
    case "offline":
      return OFFLINE;
  }
}

function deriveStatus(
  d: TraccarDevice,
  speed: number,
  acc: boolean | null,
  now: Date,
): VehicleStatus {
  const last = d.lastUpdate ? new Date(d.lastUpdate).getTime() : 0;
  const ageMs = last ? now.getTime() - last : Infinity;
  if (d.status === "offline" || ageMs > OFFLINE_AFTER_MS) return "offline";
  if (speed > 0) return "moving";
  if (acc === false) return "parked";
  return "online";
}

/** Traccar device + position → view-model §6.1 (champs métier vides). */
export function toVM(d: TraccarDevice, p: TraccarPosition | undefined, now: Date = new Date()): VehicleVM {
  const a = p?.attributes ?? {};
  const speed = p ? Math.round(p.speed * KNOTS_TO_KMH) : 0;
  const acc = typeof a.ignition === "boolean" ? a.ignition : null;
  const status = deriveStatus(d, speed, acc, now);
  const odoM = (a.odometer as number | undefined) ?? (a.totalDistance as number | undefined);
  return {
    id: d.id,
    imei: d.uniqueId,
    name: d.name,
    status,
    color: statusColor(status),
    speed,
    lat: p ? String(p.latitude) : null,
    lng: p ? String(p.longitude) : null,
    addr: p?.address ?? null,
    signal: p?.valid ? "GPS" : "LBS",
    battery: (a.battery as number | undefined) ?? null,
    voltage: (a.power as number | undefined) ?? (a.voltage as number | undefined) ?? null,
    acc,
    sats: (a.sat as number | undefined) ?? null,
    gsm: (a.rssi as number | undefined) ?? null,
    odo: typeof odoM === "number" ? Math.round(odoM / 1000) : null,
    heading: p ? Math.round(p.course) : null,
    model: d.model ?? null,
    lastSeen: d.lastUpdate ?? null,
    plate: null,
    type: null,
    sim: null,
    phone: d.phone ?? null,
    iccid: null,
    owner: d.contact ?? null,
    ownerId: null,
    iconKey: null,
  };
}

/** Fusionne les champs métier (base app) par-dessus le VM Traccar. */
export function mergeRow(vm: VehicleVM, row: DeviceRow | undefined): VehicleVM {
  if (!row) return vm;
  return {
    ...vm,
    name: row.name ?? vm.name,
    plate: row.plate ?? vm.plate,
    type: row.type ?? vm.type,
    sim: row.sim_operator ?? vm.sim,
    phone: row.sim_phone ?? vm.phone,
    iccid: row.iccid ?? vm.iccid,
    owner: row.owner_contact ?? vm.owner,
    ownerId: row.owner_id ?? vm.ownerId,
    iconKey: row.icon_key ?? vm.iconKey,
    model: row.model ?? vm.model,
  };
}
