import { Injectable, NotFoundException } from "@nestjs/common";
import { TraccarService } from "../traccar/traccar.service";
import { DevicesService, type DevicePatch, type DeviceRow } from "../supabase/devices.service";
import { AccessService } from "../supabase/access.service";
import type { TraccarDevice, TraccarPosition } from "../traccar/traccar.types";
import type { VehicleStatus, VehicleVM } from "./vehicle.vm";

const KNOTS_TO_KMH = 1.852;

// Couleurs statut (miroir des tokens mobile — jamais le lime).
const ONLINE = "#36D399";
const PARKED = "#FFB14E";
const OFFLINE = "#8E8E93";

// Seuils de fraîcheur (handoff §6.1 / freshColor) — externalisés.
const OFFLINE_AFTER_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class VehiclesService {
  constructor(
    private readonly traccar: TraccarService,
    private readonly devices: DevicesService,
    private readonly access: AccessService,
  ) {}

  /** Liste FILTRÉE au périmètre du client (ses devices + partagés). */
  async list(userId: string, now: Date = new Date()): Promise<VehicleVM[]> {
    const allowed = await this.access.allowed(userId);
    const { devices, positions } = await this.traccar.getFleet();
    const posByDevice = new Map<number, TraccarPosition>();
    for (const p of positions) posByDevice.set(p.deviceId, p);
    const visible = devices.filter((d) => allowed.imeis.has(d.uniqueId));
    const rows = await this.devices.getByImeis(visible.map((d) => d.uniqueId));
    return visible.map((d) => this.merge(this.toVM(d, posByDevice.get(d.id), now), rows.get(d.uniqueId)));
  }

  /** PATCH champs métier (persistance base app). Vérifie l'accès puis résout l'IMEI. */
  async patch(id: number, patch: DevicePatch, userId: string): Promise<VehicleVM> {
    const { devices, positions } = await this.traccar.getFleet();
    const d = devices.find((x) => x.id === id);
    if (!d) throw new NotFoundException("Véhicule introuvable");
    const allowed = await this.access.allowed(userId);
    this.access.assertImei(allowed, d.uniqueId);
    const row = await this.devices.upsertByImei(d.uniqueId, d.id, patch);
    const pos = positions.find((p) => p.deviceId === id);
    return this.merge(this.toVM(d, pos, new Date()), row ?? undefined);
  }

  /** Fusionne les champs métier (base app) par-dessus le VM Traccar. */
  private merge(vm: VehicleVM, row: DeviceRow | undefined): VehicleVM {
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
      iconKey: row.icon_key ?? vm.iconKey,
      model: row.model ?? vm.model,
    };
  }

  private toVM(d: TraccarDevice, p: TraccarPosition | undefined, now: Date): VehicleVM {
    const a = p?.attributes ?? {};
    const speed = p ? Math.round(p.speed * KNOTS_TO_KMH) : 0;
    const acc = typeof a.ignition === "boolean" ? a.ignition : null;
    const status = this.deriveStatus(d, p, speed, acc, now);
    const odoM = (a.odometer as number | undefined) ?? (a.totalDistance as number | undefined);

    return {
      id: d.id,
      imei: d.uniqueId,
      name: d.name,
      status,
      color: this.statusColor(status),
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
      // champs métier (jointure base app à l'étape 5)
      plate: null,
      type: null,
      sim: null,
      phone: d.phone ?? null,
      iccid: null,
      owner: d.contact ?? null,
      iconKey: null,
    };
  }

  /** Réplique la logique de statut de la maquette (freshColor + vitesse + ACC). */
  private deriveStatus(
    d: TraccarDevice,
    p: TraccarPosition | undefined,
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

  private statusColor(status: VehicleStatus): string {
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
}
