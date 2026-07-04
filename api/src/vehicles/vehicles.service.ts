import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TraccarService } from "../traccar/traccar.service";
import { DevicesService, type DevicePatch } from "../supabase/devices.service";
import { AccessService } from "../supabase/access.service";
import type { TraccarDevice, TraccarPosition } from "../traccar/traccar.types";
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

  /** Enrôle un boîtier au nom du client : crée le device Traccar + la ligne app. */
  async enroll(userId: string, imei: string, name?: string): Promise<VehicleVM> {
    if (!/^\d{10,17}$/.test(imei)) throw new BadRequestException("IMEI invalide");
    if (await this.devices.existsByImei(imei)) throw new ConflictException("Ce boîtier est déjà enregistré");

    const label = name?.trim() || `Boîtier ${imei.slice(-4)}`;
    let traccarId: number;
    try {
      const dev = await this.traccar.createDevice(label, imei);
      traccarId = dev.id;
    } catch {
      throw new ConflictException("IMEI déjà présent sur le cœur GPS ou injoignable");
    }
    const row = await this.devices.insertOwned(userId, imei, traccarId, { name: label });
    const stub: TraccarDevice = { id: traccarId, name: label, uniqueId: imei, status: "offline", lastUpdate: null };
    return mergeRow(toVM(stub, undefined, new Date()), row ?? undefined);
  }

  /** Supprime un véhicule (propriétaire uniquement) : device Traccar + ligne app. */
  async remove(id: number, userId: string): Promise<{ deleted: true }> {
    const { devices } = await this.traccar.getFleet();
    const d = devices.find((x) => x.id === id);
    if (!d) throw new NotFoundException("Véhicule introuvable");
    const rows = await this.devices.getByImeis([d.uniqueId]);
    const row = rows.get(d.uniqueId);
    if (!row || row.owner_id !== userId) throw new ForbiddenException("Seul le propriétaire peut supprimer");

    await this.devices.deleteByImei(d.uniqueId);
    try {
      await this.traccar.deleteDevice(id);
    } catch {
      /* déjà absent côté Traccar : app nettoyée quand même */
    }
    return { deleted: true };
  }
}
