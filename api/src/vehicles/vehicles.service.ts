import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
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

  /**
   * Liste FILTRÉE au périmètre du client (§device_access). Inclut les accès À
   * REVALIDER (§5) marqués `accessStatus='revalidate'` → grisés côté mobile.
   */
  async list(userId: string, now: Date = new Date()): Promise<VehicleVM[]> {
    const map = await this.access.accessByImei(userId);
    const { devices, positions } = await this.traccar.getFleet();
    const posByDevice = new Map<number, TraccarPosition>();
    for (const p of positions) posByDevice.set(p.deviceId, p);
    const visible = devices.filter((d) => map.has(d.uniqueId));
    const rows = await this.devices.getByImeis(visible.map((d) => d.uniqueId));
    return visible.map((d) => {
      const a = map.get(d.uniqueId)!;
      const vm = mergeRow(toVM(d, posByDevice.get(d.id), now), rows.get(d.uniqueId));
      return { ...vm, accessRole: a.role, accessStatus: a.status };
    });
  }

  /** PATCH champs métier = écriture → rôle 'action' requis (consultation = lecture seule). */
  async patch(id: number, patch: DevicePatch, userId: string): Promise<VehicleVM> {
    const { devices, positions } = await this.traccar.getFleet();
    const d = devices.find((x) => x.id === id);
    if (!d) throw new NotFoundException("Véhicule introuvable");
    const allowed = await this.access.allowed(userId);
    this.access.assertAction(allowed, d.uniqueId);
    const row = await this.devices.upsertByImei(d.uniqueId, d.id, userId, patch);
    const pos = positions.find((p) => p.deviceId === id);
    const a = allowed.role?.get(d.uniqueId) ?? null;
    return { ...mergeRow(toVM(d, pos, new Date()), row ?? undefined), accessRole: a, accessStatus: a ? "active" : null };
  }

  /**
   * Ajoute un ACCÈS coexistant à un device EXISTANT via IMEI + mot de passe device
   * (§3). Aucun propriétaire, plusieurs comptes coexistent sans se gêner. Erreur
   * générique unique (anti-énumération), rate-limit géré en base.
   */
  async addAccess(userId: string, imei: string, devicePassword: string): Promise<VehicleVM> {
    if (!/^\d{10,17}$/.test(imei) || !devicePassword) {
      throw new HttpException({ message: "IMEI ou mot de passe incorrect", code: "bad_credentials" }, HttpStatus.FORBIDDEN);
    }
    const res = await this.devices.addAccess(imei, devicePassword, userId);
    if (res === "rate_limited") {
      throw new HttpException({ message: "Trop de tentatives. Réessaie dans 15 minutes.", code: "rate_limited" }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (res !== "ok") {
      throw new HttpException({ message: "IMEI ou mot de passe incorrect", code: "bad_credentials" }, HttpStatus.FORBIDDEN);
    }
    const mine = (await this.list(userId)).find((v) => v.imei === imei);
    if (mine) return mine;
    throw new HttpException("Dispositif ajouté mais introuvable sur le cœur GPS", HttpStatus.BAD_GATEWAY);
  }

  /**
   * Enrôle un device NEUF (création cœur GPS) — chemin admin / auto-détection (§2).
   * Le créateur devient premier accès (rôle 'action', mot de passe par défaut en base).
   * Un device DÉJÀ existant s'ajoute via `addAccess` (mot de passe), pas ici.
   */
  async enroll(userId: string, imei: string, name?: string): Promise<VehicleVM> {
    if (!/^\d{10,17}$/.test(imei)) throw new BadRequestException("IMEI invalide");
    if (await this.devices.existsByImei(imei)) {
      throw new HttpException(
        { message: "Ce dispositif existe déjà. Ajoute-le avec son mot de passe.", code: "exists" },
        HttpStatus.CONFLICT,
      );
    }

    const { devices } = await this.traccar.getFleet(); // injoignable → 502 (controller.wrap)
    const existing = devices.find((d) => d.uniqueId === imei);
    const label = name?.trim() || existing?.name || `Boîtier ${imei.slice(-4)}`;

    let traccarId: number;
    if (existing) traccarId = existing.id;
    else {
      const dev = await this.traccar.createDevice(label, imei);
      traccarId = dev.id;
    }

    const row = await this.devices.insertOwned(userId, imei, traccarId, { name: label });
    if (row) await this.devices.insertAccess(row.id, userId, "action");
    const base: TraccarDevice = existing ?? { id: traccarId, name: label, uniqueId: imei, status: "offline", lastUpdate: null };
    return { ...mergeRow(toVM(base, undefined, new Date()), row ?? undefined), accessRole: "action", accessStatus: "active" };
  }

  /** Change le mot de passe DU DISPOSITIF (accès actif requis, vérifié en base). */
  async setDevicePassword(traccarDeviceId: number, userId: string, newPassword: string): Promise<boolean> {
    return this.devices.setPassword(traccarDeviceId, userId, newPassword);
  }

  /**
   * Retire le device de la liste du compte courant = supprime SON accès
   * (§device_access). Ne supprime NI le device NI les accès des autres comptes.
   */
  async remove(id: number, userId: string): Promise<{ deleted: true }> {
    const { devices } = await this.traccar.getFleet();
    const d = devices.find((x) => x.id === id);
    if (!d) throw new NotFoundException("Véhicule introuvable");
    const removed = await this.devices.removeAccessByImei(d.uniqueId, userId);
    if (!removed) throw new NotFoundException("Aucun accès à ce véhicule pour ce compte");
    return { deleted: true };
  }
}
