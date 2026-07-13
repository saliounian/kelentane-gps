import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, ParseIntPipe, Patch, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { VehiclesService } from "./vehicles.service";
import { SupabaseService } from "../supabase/supabase.service";
import { AccountsService } from "../supabase/accounts.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user";
import type { DevicePatch } from "../supabase/devices.service";
import type { VehicleVM } from "./vehicle.vm";

interface PatchBody {
  name?: string;
  plate?: string;
  type?: string;
  iconKey?: string;
  sim?: string;
  phone?: string;
}

interface EnrollBody {
  imei?: string;
  name?: string;
}

interface AccessBody {
  imei?: string;
  devicePassword?: string;
}

@Controller("vehicles")
@UseGuards(AuthGuard)
export class VehiclesController {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly supa: SupabaseService,
    private readonly accounts: AccountsService,
  ) {}

  /** GET /vehicles → view-model §6.1, FILTRÉ au périmètre du client. */
  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<VehicleVM[]> {
    try {
      return await this.vehicles.list(user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  /**
   * POST /vehicles/access → ajoute un ACCÈS coexistant à un device EXISTANT via
   * IMEI + mot de passe du dispositif (§3). C'est le chemin « Ajouter un dispositif »
   * de l'app. Erreur générique unique (anti-énumération), 429 si rate-limité.
   */
  @Post("access")
  async addAccess(@Body() body: AccessBody, @CurrentUser() user: AuthUser): Promise<VehicleVM> {
    if (!body?.imei) throw new HttpException("IMEI requis", HttpStatus.BAD_REQUEST);
    try {
      return await this.vehicles.addAccess(user.id, body.imei.replace(/\s/g, ""), body.devicePassword ?? "");
    } catch (e) {
      throw this.wrap(e);
    }
  }

  /**
   * POST /vehicles → enrôle un device NEUF (création cœur GPS) — admin / auto-détection.
   * Un device existant s'ajoute via POST /vehicles/access.
   */
  @Post()
  async enroll(@Body() body: EnrollBody, @CurrentUser() user: AuthUser): Promise<VehicleVM> {
    if (!body?.imei) throw new HttpException("IMEI requis", HttpStatus.BAD_REQUEST);
    const imei = body.imei.replace(/\s/g, "");
    try {
      const vm = await this.vehicles.enroll(user.id, imei, body.name);
      // §2 : compte walk-up IMEI + accès (non bloquant, n'échoue jamais l'enrôlement).
      await this.accounts.ensureDeviceAccount(imei);
      return vm;
    } catch (e) {
      throw this.wrap(e);
    }
  }

  /** PATCH /vehicles/:id/device-password → change le mot de passe DU DISPOSITIF
   *  (accès actif requis). Distinct du mot de passe du compte. Révoque §5 les autres. */
  @Patch(":id/device-password")
  async setDevicePassword(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { newPassword?: string },
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    const pw = body?.newPassword?.trim();
    if (!pw || pw.length < 4) throw new HttpException("Mot de passe du dispositif trop court (min. 4).", HttpStatus.BAD_REQUEST);
    let ok: boolean;
    try {
      ok = await this.vehicles.setDevicePassword(id, user.id, pw);
    } catch (e) {
      throw this.wrap(e);
    }
    if (!ok) throw new HttpException("Accès requis pour changer le mot de passe du dispositif.", HttpStatus.FORBIDDEN);
    return { ok: true };
  }

  /** DELETE /vehicles/:id → retire l'accès du compte courant (mot de passe compte
   *  requis en confirmation). Ne supprime pas le device ni les autres accès. */
  @Delete(":id")
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { password?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const ok = !!body?.password && (await this.supa.verifyPassword(user.email, body.password));
    if (!ok) throw new UnauthorizedException("Mot de passe incorrect");
    try {
      return await this.vehicles.remove(id, user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  /** PATCH /vehicles/:id → persiste les champs métier éditables (accès vérifié). */
  @Patch(":id")
  async patch(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: PatchBody,
    @CurrentUser() user: AuthUser,
  ): Promise<VehicleVM> {
    const patch: DevicePatch = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.plate !== undefined) patch.plate = body.plate;
    if (body.type !== undefined) patch.type = body.type;
    if (body.iconKey !== undefined) patch.icon_key = body.iconKey;
    if (body.sim !== undefined) patch.sim_operator = body.sim;
    if (body.phone !== undefined) patch.sim_phone = body.phone;
    try {
      return await this.vehicles.patch(id, patch, user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  private wrap(e: unknown): HttpException {
    if (e instanceof HttpException) return e;
    return new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
  }
}
