import { ForbiddenException, Injectable } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";

export type AccessRole = "consultation" | "action";
export type AccessStatus = "active" | "revalidate";

export interface AllowedSet {
  imeis: Set<string>; // accès ACTIF uniquement (guards)
  traccarIds: Set<number>;
  rowIds: Set<string>;
  role: Map<string, AccessRole>; // rôle par imei (accès actif)
}

interface AccessRow {
  imei: string | null;
  traccarId: number | null;
  deviceRowId: string;
  role: AccessRole;
  status: AccessStatus;
}

/**
 * Périmètre d'accès multi-comptes (§device_access) : plusieurs comptes peuvent
 * accéder au même device, chacun avec un rôle (consultation|action) et un statut
 * (active|revalidate). Base de l'isolation multi-tenant.
 *
 * `device_shares` (partage par jeton, scope read|commands) reste pris en compte,
 * mappé sur le même modèle (commands→action, read→consultation).
 */
@Injectable()
export class AccessService {
  constructor(private readonly supa: SupabaseService) {}

  private async loadAccess(userId: string): Promise<AccessRow[]> {
    const c = this.supa.client;
    if (!c) return [];
    const rows: AccessRow[] = [];

    const { data: da } = await c
      .from("device_access")
      .select("device_id, role, status, devices!inner(imei, traccar_id)")
      .eq("user_id", userId);
    for (const r of (da ?? []) as unknown as { device_id: string; role: AccessRole; status: AccessStatus; devices: { imei: string | null; traccar_id: number | null } }[]) {
      rows.push({ imei: r.devices?.imei ?? null, traccarId: r.devices?.traccar_id ?? null, deviceRowId: r.device_id, role: r.role, status: r.status });
    }

    const { data: sh } = await c
      .from("device_shares")
      .select("scope, devices!inner(id, imei, traccar_id)")
      .eq("shared_with", userId);
    for (const s of (sh ?? []) as unknown as { scope: string; devices: { id: string; imei: string | null; traccar_id: number | null } }[]) {
      rows.push({ imei: s.devices?.imei ?? null, traccarId: s.devices?.traccar_id ?? null, deviceRowId: s.devices?.id, role: s.scope === "commands" ? "action" : "consultation", status: "active" });
    }
    return rows;
  }

  /** Périmètre ACTIF — sert de garde pour commandes / patch / rapports. */
  async allowed(userId: string): Promise<AllowedSet> {
    const out: AllowedSet = { imeis: new Set(), traccarIds: new Set(), rowIds: new Set(), role: new Map() };
    for (const r of await this.loadAccess(userId)) {
      if (r.status !== "active") continue;
      if (r.imei) {
        out.imeis.add(r.imei);
        if (out.role.get(r.imei) !== "action") out.role.set(r.imei, r.role); // 'action' l'emporte
      }
      if (r.traccarId != null) out.traccarIds.add(r.traccarId);
      out.rowIds.add(r.deviceRowId);
    }
    return out;
  }

  /** Accès par IMEI, ACTIF + À REVALIDER — pour l'affichage (devices grisés §5) + rôle au VM. */
  async accessByImei(userId: string): Promise<Map<string, { role: AccessRole; status: AccessStatus }>> {
    const m = new Map<string, { role: AccessRole; status: AccessStatus }>();
    for (const r of await this.loadAccess(userId)) {
      if (!r.imei) continue;
      const cur = m.get(r.imei);
      const better = !cur || (cur.status === "revalidate" && r.status === "active") || (r.status === "active" && r.role === "action");
      if (better) m.set(r.imei, { role: r.role, status: r.status });
    }
    return m;
  }

  /** Garde d'accès à un véhicule par IMEI (accès actif requis). */
  assertImei(allowed: AllowedSet, imei: string): void {
    if (!allowed.imeis.has(imei)) throw new ForbiddenException("Accès refusé à ce véhicule");
  }

  /** Garde d'ACTION (commande, coupure moteur, écriture zone) : rôle 'action' requis. */
  assertAction(allowed: AllowedSet, imei: string): void {
    this.assertImei(allowed, imei);
    if (allowed.role.get(imei) !== "action") {
      throw new ForbiddenException("Action non autorisée (accès en consultation)");
    }
  }
}
