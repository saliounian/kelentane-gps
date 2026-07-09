import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";

/** Ligne de la table `devices` (champs métier de la base app). */
export interface DeviceRow {
  id: string;
  owner_id: string;
  traccar_id: number | null;
  imei: string;
  name: string | null;
  plate: string | null;
  type: string | null;
  icon_key: string | null;
  model: string | null;
  sim_operator: string | null;
  sim_phone: string | null;
  iccid: string | null;
  owner_contact: string | null;
  device_password: string | null; // hash bcrypt — SECRET serveur, jamais exposé au VM
}

/** Patch autorisé depuis le mobile (champs éditables). */
export interface DevicePatch {
  name?: string;
  plate?: string;
  type?: string;
  icon_key?: string;
  sim_operator?: string;
  sim_phone?: string;
}

@Injectable()
export class DevicesService {
  private readonly log = new Logger(DevicesService.name);

  constructor(private readonly supa: SupabaseService) {}

  get enabled(): boolean {
    return this.supa.client !== null;
  }

  /** Champs métier par IMEI (jointure sur le view-model). */
  async getByImeis(imeis: string[]): Promise<Map<string, DeviceRow>> {
    const out = new Map<string, DeviceRow>();
    if (!this.supa.client || imeis.length === 0) return out;
    const { data, error } = await this.supa.client.from("devices").select("*").in("imei", imeis);
    if (error) {
      this.log.error(`Lecture devices: ${error.message}`);
      return out;
    }
    for (const row of (data ?? []) as DeviceRow[]) out.set(row.imei, row);
    return out;
  }

  /**
   * Enregistre les champs métier d'un device (clé = IMEI).
   * - Ligne existante → UPDATE des seuls champs métier ; `owner_id` n'est JAMAIS
   *   touché (bug corrigé : l'ancien upsert réécrivait owner_id sur une fixture).
   * - Ligne absente → création possédée par l'utilisateur authentifié `ownerId`.
   */
  async upsertByImei(imei: string, traccarId: number, ownerId: string, patch: DevicePatch): Promise<DeviceRow | null> {
    if (!this.supa.client) return null;
    const { data: updated, error } = await this.supa.client
      .from("devices")
      .update({ traccar_id: traccarId, ...patch })
      .eq("imei", imei)
      .select("*")
      .maybeSingle();
    if (error) {
      this.log.error(`Update device ${imei}: ${error.message}`);
      throw error;
    }
    if (updated) return updated as DeviceRow;
    return this.insertOwned(ownerId, imei, traccarId, patch);
  }

  /** Existe déjà (n'importe quel tenant) ? */
  async existsByImei(imei: string): Promise<boolean> {
    if (!this.supa.client) return false;
    const { data } = await this.supa.client.from("devices").select("id").eq("imei", imei).maybeSingle();
    return !!data;
  }

  /**
   * Transfère la propriété d'un device APRÈS vérification du mot de passe device
   * (comparaison bcrypt en base via RPC SECURITY DEFINER). Le hash ne quitte
   * jamais Postgres. Retourne true si transféré, false si mot de passe incorrect.
   */
  async transferByImei(imei: string, devicePassword: string, newOwnerId: string): Promise<boolean> {
    if (!this.supa.client) return false;
    const { data, error } = await this.supa.client.rpc("device_transfer", {
      p_imei: imei,
      p_password: devicePassword,
      p_new_owner: newOwnerId,
    });
    if (error) {
      this.log.error(`device_transfer ${imei}: ${error.message}`);
      throw error;
    }
    return data === true;
  }

  /** Change le mot de passe device (propriétaire uniquement, vérifié en base). */
  async setPassword(traccarId: number, ownerId: string, newPassword: string): Promise<boolean> {
    if (!this.supa.client) return false;
    const { data, error } = await this.supa.client.rpc("device_set_password", {
      p_traccar_id: traccarId,
      p_owner: ownerId,
      p_new: newPassword,
    });
    if (error) {
      this.log.error(`device_set_password ${traccarId}: ${error.message}`);
      throw error;
    }
    return data === true;
  }

  /** Enrôle un nouveau device au nom du client (owner = userId). */
  async insertOwned(ownerId: string, imei: string, traccarId: number, patch: DevicePatch): Promise<DeviceRow | null> {
    if (!this.supa.client) return null;
    const { data, error } = await this.supa.client
      .from("devices")
      .insert({ owner_id: ownerId, imei, traccar_id: traccarId, ...patch })
      .select("*")
      .single();
    if (error) {
      this.log.error(`Insert device ${imei}: ${error.message}`);
      throw error;
    }
    return data as DeviceRow;
  }

  /** Supprime le device (cascade shares/geofences via FK). Retourne traccar_id. */
  async deleteByImei(imei: string): Promise<number | null> {
    if (!this.supa.client) return null;
    const { data } = await this.supa.client.from("devices").select("traccar_id").eq("imei", imei).maybeSingle();
    await this.supa.client.from("devices").delete().eq("imei", imei);
    return (data?.traccar_id as number | null) ?? null;
  }
}
