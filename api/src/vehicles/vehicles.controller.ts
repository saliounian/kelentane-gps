import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, ParseIntPipe, Patch, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { VehiclesService } from "./vehicles.service";
import { SupabaseService } from "../supabase/supabase.service";
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
  devicePassword?: string; // requis seulement pour transférer un IMEI déjà enregistré
}

@Controller("vehicles")
@UseGuards(AuthGuard)
export class VehiclesController {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly supa: SupabaseService,
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

  /** POST /vehicles → enrôle un boîtier (IMEI) au nom du client. */
  @Post()
  async enroll(@Body() body: EnrollBody, @CurrentUser() user: AuthUser): Promise<VehicleVM> {
    if (!body?.imei) throw new HttpException("IMEI requis", HttpStatus.BAD_REQUEST);
    try {
      return await this.vehicles.enroll(user.id, body.imei.replace(/\s/g, ""), body.name, body.devicePassword);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  /** PATCH /vehicles/:id/device-password → change le mot de passe DU DISPOSITIF
   *  (propriétaire uniquement). Distinct du mot de passe du compte. */
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
    if (!ok) throw new HttpException("Seul le propriétaire peut changer le mot de passe du dispositif.", HttpStatus.FORBIDDEN);
    return { ok: true };
  }

  /** DELETE /vehicles/:id → retire un véhicule. Exige le mot de passe DU COMPTE
   *  (vérifié côté serveur) + propriétaire du véhicule. */
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
