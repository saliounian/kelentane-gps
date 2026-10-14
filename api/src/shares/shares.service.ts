import { randomBytes } from "crypto";
import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { TraccarService } from "../traccar/traccar.service";
import { DevicesService } from "../supabase/devices.service";
import { SupabaseService } from "../supabase/supabase.service";
import { AccessService } from "../supabase/access.service";

@Injectable()
export class SharesService {
  constructor(
    private readonly traccar: TraccarService,
    private readonly devices: DevicesService,
    private readonly supa: SupabaseService,
    private readonly access: AccessService,
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
    const allowed = await this.access.allowed(userId);
    this.access.assertAction(allowed, d.uniqueId); // créer un partage = action (donne accès à un tiers), pas une lecture
    const row = await this.devices.upsertByImei(d.uniqueId, d.id, userId, {});
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

  /**
   * Révoque un partage (§device_shares). Rôle 'action' requis sur le véhicule
   * concerné (même garde que les autres écritures — pas réservé au créateur du
   * partage). 404 si le partage n'existe pas, 403 si rôle insuffisant.
   *
   * Pas de nettoyage device_access : vérifié dans AccessService.loadAccess —
   * l'accès issu d'un partage est résolu EN DIRECT depuis device_shares.shared_with
   * à chaque requête (scope read|commands → consultation|action), aucune ligne
   * device_access n'est créée lors du claim. Supprimer la ligne device_shares
   * suffit donc à révoquer intégralement l'accès.
   */
  async revoke(shareId: string, userId: string): Promise<{ revoked: true }> {
    const client = this.client();
    const { data: share, error } = await client
      .from("device_shares")
      .select("id, device_id")
      .eq("id", shareId)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException(error.message);
    if (!share) throw new NotFoundException("Partage introuvable");

    const { data: device, error: devErr } = await client
      .from("devices")
      .select("imei")
      .eq("id", (share as { device_id: string }).device_id)
      .maybeSingle();
    if (devErr) throw new ServiceUnavailableException(devErr.message);
    if (!device) throw new NotFoundException("Partage introuvable");

    const allowed = await this.access.allowed(userId);
    this.access.assertAction(allowed, (device as { imei: string }).imei); // 403 si rôle insuffisant

    const { error: delErr } = await client.from("device_shares").delete().eq("id", shareId);
    if (delErr) throw new ServiceUnavailableException(delErr.message);
    return { revoked: true };
  }
}
