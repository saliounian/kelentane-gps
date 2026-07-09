import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
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

  /**
   * Enrôle OU transfère un boîtier (IMEI) au nom du client.
   *
   * - IMEI déjà en base (autre owner) → TRANSFERT protégé par le mot de passe DU
   *   DISPOSITIF (§transfert) : sans mot de passe → 409 `transfer_required` (l'app
   *   propose le champ) ; mauvais mot de passe → 403 `bad_device_password` ; sinon
   *   la propriété passe au client courant.
   * - IMEI absent de la base app → on ADOPTE le device Traccar existant s'il est
   *   déjà là (évite le faux « déjà enregistré »), sinon on le crée.
   * - Traccar réellement injoignable → l'erreur remonte en 502 (plus confondue
   *   avec un doublon, cf. bug historique EAI_AGAIN).
   */
  async enroll(userId: string, imei: string, name?: string, devicePassword?: string): Promise<VehicleVM> {
    if (!/^\d{10,17}$/.test(imei)) throw new BadRequestException("IMEI invalide");

    if (await this.devices.existsByImei(imei)) {
      if (!devicePassword) {
        throw new HttpException(
          {
            message: "Ce dispositif appartient déjà à un compte. Saisis son mot de passe pour le transférer.",
            code: "transfer_required",
          },
          HttpStatus.CONFLICT,
        );
      }
      const ok = await this.devices.transferByImei(imei, devicePassword, userId);
      if (!ok) {
        throw new HttpException(
          { message: "Mot de passe incorrect pour ce dispositif", code: "bad_device_password" },
          HttpStatus.FORBIDDEN,
        );
      }
      const mine = (await this.list(userId)).find((v) => v.imei === imei);
      if (mine) return mine;
      throw new HttpException("Dispositif transféré mais introuvable sur le cœur GPS", HttpStatus.BAD_GATEWAY);
    }

    // Absent de la base app : adopter le device Traccar existant, sinon le créer.
    const { devices } = await this.traccar.getFleet(); // injoignable → remonte en 502 (controller.wrap)
    const existing = devices.find((d) => d.uniqueId === imei);
    const label = name?.trim() || existing?.name || `Boîtier ${imei.slice(-4)}`;

    let traccarId: number;
    if (existing) {
      traccarId = existing.id; // déjà sur le cœur GPS mais non rattaché → on l'adopte
    } else {
      const dev = await this.traccar.createDevice(label, imei);
      traccarId = dev.id;
    }

    // device_password = défaut "123456" (colonne DEFAULT en base), modifiable ensuite.
    const row = await this.devices.insertOwned(userId, imei, traccarId, { name: label });
    const base: TraccarDevice = existing ?? { id: traccarId, name: label, uniqueId: imei, status: "offline", lastUpdate: null };
    return mergeRow(toVM(base, undefined, new Date()), row ?? undefined);
  }

  /** Change le mot de passe DU DISPOSITIF (propriétaire uniquement, vérifié en base). */
  async setDevicePassword(traccarDeviceId: number, userId: string, newPassword: string): Promise<boolean> {
    return this.devices.setPassword(traccarDeviceId, userId, newPassword);
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
