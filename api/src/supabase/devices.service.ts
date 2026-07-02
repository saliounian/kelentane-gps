import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
  private readonly seedOwner: string;

  constructor(
    private readonly supa: SupabaseService,
    config: ConfigService,
  ) {
    // Propriétaire de dev tant que l'auth n'est pas branchée (étape 8/9).
    this.seedOwner = config.get<string>("SEED_OWNER_ID") ?? "000000aa-0000-0000-0000-0000000000aa";
  }

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

  /** Upsert des champs métier d'un device (clé = IMEI). */
  async upsertByImei(imei: string, traccarId: number, patch: DevicePatch): Promise<DeviceRow | null> {
    if (!this.supa.client) return null;
    const { data, error } = await this.supa.client
      .from("devices")
      .upsert(
        { imei, traccar_id: traccarId, owner_id: this.seedOwner, ...patch },
        { onConflict: "imei" },
      )
      .select("*")
      .single();
    if (error) {
      this.log.error(`Upsert device ${imei}: ${error.message}`);
      throw error;
    }
    return data as DeviceRow;
  }
}
