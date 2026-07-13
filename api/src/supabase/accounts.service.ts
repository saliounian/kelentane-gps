import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";
import { DevicesService } from "./devices.service";

/** Identité synthétique = email dérivé (miroir de usernameToEmail côté mobile). */
export function identifierToEmail(identifier: string): string {
  return `${identifier.trim().toLowerCase()}@kelentane.com`;
}

/**
 * Comptes auto-provisionnés (§2). À l'enregistrement d'un device, on crée un compte
 * « walk-up » minimal (identifiant = IMEI, mot de passe par défaut « 123456 ») afin
 * qu'un client puisse se connecter avec l'IMEI sans inscription manuelle. Ce compte
 * n'a AUCUN privilège de propriétaire : simple accès coexistant (§device_access).
 */
@Injectable()
export class AccountsService {
  private readonly log = new Logger(AccountsService.name);

  constructor(
    private readonly supa: SupabaseService,
    private readonly devices: DevicesService,
  ) {}

  /**
   * Crée (si absent) le compte IMEI et lui accorde l'accès à SON device.
   * Idempotent : si le compte existe déjà (createAuthUser → null), on ne fait rien
   * (l'accès a été provisionné à la création initiale). Non bloquant.
   */
  async ensureDeviceAccount(imei: string): Promise<void> {
    try {
      const uid = await this.supa.createAuthUser(identifierToEmail(imei), "123456");
      if (!uid) return;
      const row = await this.devices.getRowByImei(imei);
      if (row) await this.devices.insertAccess(row.id, uid, "action");
    } catch (e) {
      // §2 non bloquant : un échec d'auto-compte n'empêche pas l'enrôlement.
      this.log.warn(`ensureDeviceAccount ${imei}: ${(e as Error).message}`);
    }
  }
}
