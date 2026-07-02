import { randomBytes } from "crypto";
import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { TraccarService } from "../traccar/traccar.service";
import { DevicesService } from "../supabase/devices.service";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class SharesService {
  constructor(
    private readonly traccar: TraccarService,
    private readonly devices: DevicesService,
    private readonly supa: SupabaseService,
  ) {}

  private client() {
    if (!this.supa.client) throw new ServiceUnavailableException("Base app indisponible");
    return this.supa.client;
  }

  private token(): string {
    return `KLN-${randomBytes(4).toString("hex").toUpperCase()}`;
  }

  /** Émet un jeton de partage (lecture) pour un véhicule. */
  async create(vehicleId: number, userId: string): Promise<{ token: string; scope: string }> {
    const client = this.client();
    const { devices } = await this.traccar.getFleet();
    const d = devices.find((x) => x.id === vehicleId);
    if (!d) throw new NotFoundException("Véhicule introuvable");
    const row = await this.devices.upsertByImei(d.uniqueId, d.id, {});
    if (!row) throw new ServiceUnavailableException("Base app indisponible");

    const token = this.token();
    const { error } = await client.from("device_shares").insert({
      device_id: row.id,
      created_by: userId,
      share_token: token,
      scope: "read",
    });
    if (error) throw new ServiceUnavailableException(error.message);
    return { token, scope: "read" };
  }

  /** Réclame un jeton : lie le bénéficiaire (shared_with). */
  async claim(token: string, userId: string): Promise<{ ok: true }> {
    const client = this.client();
    const { data, error } = await client
      .from("device_shares")
      .select("id,shared_with")
      .eq("share_token", token.trim())
      .maybeSingle();
    if (error) throw new ServiceUnavailableException(error.message);
    if (!data) throw new NotFoundException("Jeton invalide");
    if (!data.shared_with) {
      const { error: uErr } = await client.from("device_shares").update({ shared_with: userId }).eq("id", data.id);
      if (uErr) throw new ServiceUnavailableException(uErr.message);
    }
    return { ok: true };
  }
}
