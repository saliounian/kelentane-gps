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
   *
   * SÉCURITÉ (C2) : un device DÉJÀ connu — présent en base app OU déjà dans la flotte
   * Traccar — n'est JAMAIS adopté sans mot de passe. Il est routé par le MÊME chemin
   * que « Ajouter un dispositif » (`addAccess`) : vérification du mot de passe device,
   * erreur générique unique (anti-énumération), rate-limit en base. Plus aucun cas
   * particulier « adoption sans mot de passe ».
   *
   * Seul un IMEI RÉELLEMENT NEUF (inconnu de la base ET de Traccar) crée un device :
   * le créateur en devient premier accès (rôle 'action'), et la colonne `device_password`
   * reçoit son défaut hashé (123456) en base (NOT NULL) — jamais vide/null.
   */
  async enroll(userId: string, imei: string, name?: string, devicePassword?: string): Promise<VehicleVM> {
    if (!/^\d{10,17}$/.test(imei)) throw new BadRequestException("IMEI invalide");

    const existsInApp = await this.devices.existsByImei(imei);
    const { devices } = await this.traccar.getFleet(); // injoignable → 502 (controller.wrap)
    const existing = devices.find((d) => d.uniqueId === imei);

    // Device déjà connu (base app OU cœur GPS) → exige le mot de passe device,
    // exactement comme addAccess. Un orphelin Traccar sans ligne base app renverra
    // l'erreur générique (RPC device_add_access ne le trouve pas) → il doit être
    // provisionné côté admin (bulk-enroll) avant d'être ajouté par un client.
    if (existsInApp || existing) {
      return this.addAccess(userId, imei, devicePassword ?? "");
    }

    // IMEI réellement neuf → création cœur GPS + premier accès.
    const label = name?.trim() || `Boîtier ${imei.slice(-4)}`;
    const dev = await this.traccar.createDevice(label, imei);
    const row = await this.devices.insertOwned(userId, imei, dev.id, { name: label });
    if (row) await this.devices.insertAccess(row.id, userId, "action");
    const base: TraccarDevice = { id: dev.id, name: label, uniqueId: imei, status: "offline", lastUpdate: null };
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
