import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { VehiclesService } from "./vehicles.service";
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

@Controller("vehicles")
@UseGuards(AuthGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

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
      return await this.vehicles.enroll(user.id, body.imei.replace(/\s/g, ""), body.name);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  /** DELETE /vehicles/:id → retire un véhicule (propriétaire uniquement). */
  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
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
