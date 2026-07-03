import { ForbiddenException, Injectable } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";

export interface AllowedSet {
  imeis: Set<string>;
  traccarIds: Set<number>;
  rowIds: Set<string>;
}

/**
 * Périmètre d'accès d'un client authentifié : ses propres devices + ceux
 * partagés avec lui. Base de l'isolation multi-tenant (confidentialité inter-clients).
 */
@Injectable()
export class AccessService {
  constructor(private readonly supa: SupabaseService) {}

  async allowed(userId: string): Promise<AllowedSet> {
    const out: AllowedSet = { imeis: new Set(), traccarIds: new Set(), rowIds: new Set() };
    const c = this.supa.client;
    if (!c) return out;

    const { data: owned } = await c.from("devices").select("id,imei,traccar_id").eq("owner_id", userId);
    const { data: shareRows } = await c.from("device_shares").select("device_id").eq("shared_with", userId);
    const sharedIds = (shareRows ?? []).map((r) => r.device_id as string).filter(Boolean);
    let shared: { id: string; imei: string; traccar_id: number | null }[] = [];
    if (sharedIds.length) {
      const { data } = await c.from("devices").select("id,imei,traccar_id").in("id", sharedIds);
      shared = (data as typeof shared) ?? [];
    }
    for (const d of [...((owned as typeof shared) ?? []), ...shared]) {
      if (d.imei) out.imeis.add(d.imei);
      if (d.traccar_id != null) out.traccarIds.add(d.traccar_id);
      out.rowIds.add(d.id);
    }
    return out;
  }

  /** Garde d'accès à un véhicule par IMEI (robuste : l'IMEI est toujours présent). */
  assertImei(allowed: AllowedSet, imei: string): void {
    if (!allowed.imeis.has(imei)) throw new ForbiddenException("Accès refusé à ce véhicule");
  }
}
