import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseService } from "../supabase/supabase.service";
import { DevicesService } from "../supabase/devices.service";
import { identifierToEmail } from "../supabase/accounts.service";

export type SubRole = "consultation" | "action";

export interface SubaccountVM {
  id: string;
  name: string | null;
  username: string | null;
  devices: { imei: string; role: SubRole; status: string }[];
}

/**
 * Gestion des SOUS-COMPTES (§4) — logique backend PARTAGÉE (mobile lecture seule
 * pour connexion/consultation, gestion réservée au WEB). Un compte principal
 * (parent_account_id NULL) crée des employés et leur accorde un accès par device
 * avec un rôle (consultation | action). Un sous-compte ne peut PAS gérer d'équipe.
 */
@Injectable()
export class SubaccountsService {
  constructor(
    private readonly supa: SupabaseService,
    private readonly devices: DevicesService,
  ) {}

  private client(): SupabaseClient {
    const c = this.supa.client;
    if (!c) throw new ServiceUnavailableException("Base indisponible");
    return c;
  }

  /** Le caller doit être un compte PRINCIPAL (pas un sous-compte). */
  private async assertMain(userId: string): Promise<void> {
    const { data } = await this.client().from("clients").select("parent_account_id").eq("id", userId).maybeSingle();
    if (!data) throw new ForbiddenException("Compte introuvable");
    if ((data as { parent_account_id: string | null }).parent_account_id) {
      throw new ForbiddenException("Un sous-compte ne peut pas gérer d'équipe.");
    }
  }

  /** Le sous-compte doit appartenir au parent. */
  private async assertOwned(subId: string, parentId: string): Promise<void> {
    const { data } = await this.client()
      .from("clients")
      .select("id")
      .eq("id", subId)
      .eq("parent_account_id", parentId)
      .maybeSingle();
    if (!data) throw new ForbiddenException("Sous-compte non rattaché à ton compte.");
  }

  /** Crée un sous-compte (employé) rattaché au compte principal. */
  async create(parentId: string, name: string, username: string, password: string): Promise<{ id: string; username: string }> {
    await this.assertMain(parentId);
    const uid = await this.supa.createAuthUser(identifierToEmail(username), password);
    if (!uid) throw new ConflictException("Nom d'utilisateur déjà pris.");
    // Le trigger a créé la ligne clients ; on la rattache au parent.
    await this.client().from("clients").update({ parent_account_id: parentId, name, username }).eq("id", uid);
    return { id: uid, username };
  }

  /** Liste les sous-comptes du parent + leurs accès par device. */
  async list(parentId: string): Promise<SubaccountVM[]> {
    await this.assertMain(parentId);
    const c = this.client();
    const { data: subs } = await c.from("clients").select("id,name,username").eq("parent_account_id", parentId);
    const out: SubaccountVM[] = [];
    for (const s of (subs ?? []) as { id: string; name: string | null; username: string | null }[]) {
      const { data: acc } = await c
        .from("device_access")
        .select("role,status,devices!inner(imei)")
        .eq("user_id", s.id);
      out.push({
        id: s.id,
        name: s.name,
        username: s.username,
        devices: ((acc ?? []) as unknown as { role: SubRole; status: string; devices: { imei: string } }[]).map((a) => ({
          imei: a.devices.imei,
          role: a.role,
          status: a.status,
        })),
      });
    }
    return out;
  }

  /** Accorde/ajuste l'accès d'un sous-compte à un device (rôle consultation|action). */
  async grant(parentId: string, subId: string, imei: string, role: SubRole): Promise<boolean> {
    if (role !== "consultation" && role !== "action") throw new ForbiddenException("Rôle invalide.");
    await this.assertMain(parentId);
    await this.assertOwned(subId, parentId);
    const row = await this.devices.getRowByImei(imei);
    if (!row) throw new NotFoundException("Dispositif introuvable.");
    // La RPC re-vérifie : parent a accès actif au device + sub rattaché au parent.
    const ok = await this.devices.grantSubaccount(row.id, subId, role, parentId);
    if (!ok) throw new ForbiddenException("Tu dois avoir un accès actif à ce dispositif pour le déléguer.");
    return true;
  }

  /** Révoque l'accès d'un sous-compte à un device. */
  async revoke(parentId: string, subId: string, imei: string): Promise<void> {
    await this.assertMain(parentId);
    await this.assertOwned(subId, parentId);
    const row = await this.devices.getRowByImei(imei);
    if (!row) return;
    await this.client().from("device_access").delete().eq("device_id", row.id).eq("user_id", subId).eq("granted_by", parentId);
  }

  /** Supprime un sous-compte (auth + clients + accès cascadent). */
  async remove(parentId: string, subId: string): Promise<void> {
    await this.assertMain(parentId);
    await this.assertOwned(subId, parentId);
    await this.supa.deleteAuthUser(subId);
  }
}
