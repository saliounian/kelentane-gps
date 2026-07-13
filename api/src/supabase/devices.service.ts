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
   * Ajoute un ACCÈS coexistant au device (§device_access) après vérif du mot de
   * passe device + rate-limit, entièrement en base (RPC SECURITY DEFINER). Ne touche
   * PAS aux accès des autres comptes. Retourne 'ok' | 'bad' | 'rate_limited'
   * ('bad' identique pour IMEI inconnu ou mauvais mot de passe — anti-énumération).
   */
  async addAccess(imei: string, devicePassword: string, userId: string): Promise<"ok" | "bad" | "rate_limited"> {
    if (!this.supa.client) return "bad";
    const { data, error } = await this.supa.client.rpc("device_add_access", {
      p_imei: imei,
      p_password: devicePassword,
      p_user: userId,
    });
    if (error) {
      this.log.error(`device_add_access ${imei}: ${error.message}`);
      throw error;
    }
    return (data as "ok" | "bad" | "rate_limited") ?? "bad";
  }

  /** Premier accès du créateur lors de l'enrôlement d'un device NEUF (sans mot de passe). */
  async insertAccess(deviceRowId: string, userId: string, role: "consultation" | "action" = "action"): Promise<void> {
    if (!this.supa.client) return;
    const { error } = await this.supa.client
      .from("device_access")
      .upsert({ device_id: deviceRowId, user_id: userId, role, status: "active" }, { onConflict: "device_id,user_id" });
    if (error) this.log.error(`insertAccess ${deviceRowId}: ${error.message}`);
  }

  /** Accorde/ajuste l'accès d'un SOUS-COMPTE à un device (§4, réservé compte principal). */
  async grantSubaccount(deviceRowId: string, subUserId: string, role: "consultation" | "action", parentId: string): Promise<boolean> {
    if (!this.supa.client) return false;
    const { data, error } = await this.supa.client.rpc("device_grant_subaccount", {
      p_device_id: deviceRowId,
      p_sub_user: subUserId,
      p_role: role,
      p_parent: parentId,
    });
    if (error) {
      this.log.error(`device_grant_subaccount ${deviceRowId}: ${error.message}`);
      throw error;
    }
    return data === true;
  }

  /** Ligne device (id + traccar_id) par IMEI — pour résoudre le device_id d'un accès. */
  async getRowByImei(imei: string): Promise<{ id: string; traccar_id: number | null } | null> {
    if (!this.supa.client) return null;
    const { data } = await this.supa.client.from("devices").select("id, traccar_id").eq("imei", imei).maybeSingle();
    return (data as { id: string; traccar_id: number | null } | null) ?? null;
  }

  /**
   * Retire l'accès du compte courant à un device (§device_access). Ne supprime NI
   * le device NI les accès des autres comptes — cohabitation préservée. Retourne
   * true si une ligne d'accès a été retirée.
   */
  async removeAccessByImei(imei: string, userId: string): Promise<boolean> {
    if (!this.supa.client) return false;
    const row = await this.getRowByImei(imei);
    if (!row) return false;
    const { error, count } = await this.supa.client
      .from("device_access")
      .delete({ count: "exact" })
      .eq("device_id", row.id)
      .eq("user_id", userId);
    if (error) {
      this.log.error(`removeAccess ${imei}: ${error.message}`);
      throw error;
    }
    return (count ?? 0) > 0;
  }

  /** Rate-limit login IMEI (§3.5) : true si l'IMEI est bloqué (5 échecs / 15 min). */
  async loginBlocked(imei: string): Promise<boolean> {
    if (!this.supa.client) return false;
    const { data, error } = await this.supa.client.rpc("device_attempts_blocked", { p_imei: imei });
    if (error) {
      this.log.error(`device_attempts_blocked ${imei}: ${error.message}`);
      return false; // ne bloque pas la connexion si le rate-limit est indisponible
    }
    return data === true;
  }

  /** Incrémente (échec) ou réinitialise (succès) le compteur de tentatives IMEI. */
  async loginBump(imei: string, reset: boolean): Promise<void> {
    if (!this.supa.client) return;
    await this.supa.client.rpc("device_attempts_bump", { p_imei: imei, p_reset: reset });
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
