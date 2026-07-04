import { Injectable, NotFoundException } from "@nestjs/common";
import { TraccarService } from "../traccar/traccar.service";
import { DevicesService, type DevicePatch } from "../supabase/devices.service";
import { AccessService } from "../supabase/access.service";
import type { TraccarPosition } from "../traccar/traccar.types";
import type { VehicleVM } from "./vehicle.vm";
import { mergeRow, toVM } from "./vehicle.mapper";

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
    return visible.map((d) => mergeRow(toVM(d, posByDevice.get(d.id), now), rows.get(d.uniqueId)));
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
    return mergeRow(toVM(d, pos, new Date()), row ?? undefined);
  }
}
