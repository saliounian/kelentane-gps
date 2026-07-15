import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";
import { DevicesService } from "./devices.service";

/** Identité synthétique = email dérivé (miroir de usernameToEmail côté mobile). */
export function identifierToEmail(identifier: string): string {
  return `${identifier.trim().toLowerCase()}@kelentane.com`;
}

/** Mot de passe par défaut du compte walk-up IMEI (§2 : nudge de changement côté app). */
export const DEFAULT_DEVICE_PASSWORD = "123456";

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
   * Crée (ou résout, si déjà présent) le compte walk-up IMEI et lui accorde
   * l'accès ACTION à SON device. Idempotent (compte + accès). Ne PAS avaler :
   * lève en cas d'échec réel afin que l'appelant le trace explicitement — cf.
   * VehiclesController (enroll + addAccess) qui l'exécute en non-bloquant loggé.
   */
  async ensureDeviceAccount(imei: string): Promise<void> {
    const email = identifierToEmail(imei);
    const row = await this.devices.getRowByImei(imei);
    if (!row) {
      // Device pas encore en base app → rien à rattacher. Signalé (plus de silence).
      throw new Error(`device ${imei} introuvable en base — accès walk-up non provisionné`);
    }
    const uid = await this.supa.createAuthUser(email, DEFAULT_DEVICE_PASSWORD);
    if (!uid) {
      // createAuthUser a déjà loggé la cause exacte (niveau ERROR).
      throw new Error(`compte walk-up ${email} non créé/résolu`);
    }
    await this.devices.insertAccess(row.id, uid, "action"); // idempotent (upsert)
    this.log.log(`walk-up IMEI ${imei} provisionné (accès action)`);
  }
}
