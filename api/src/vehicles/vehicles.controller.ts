import { Body, Controller, Get, HttpException, HttpStatus, Param, ParseIntPipe, Patch } from "@nestjs/common";
import { VehiclesService } from "./vehicles.service";
import type { DevicePatch } from "../supabase/devices.service";
import type { VehicleVM } from "./vehicle.vm";

/** Corps de PATCH côté mobile (noms « produit » → colonnes DB). */
interface PatchBody {
  name?: string;
  plate?: string;
  type?: string;
  iconKey?: string;
  sim?: string;
  phone?: string;
}

@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  /** GET /vehicles → view-model §6.1 (Traccar + champs métier). */
  @Get()
  async list(): Promise<VehicleVM[]> {
    try {
      return await this.vehicles.list();
    } catch {
      throw new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
    }
  }

  /** PATCH /vehicles/:id → persiste les champs métier éditables. */
  @Patch(":id")
  async patch(@Param("id", ParseIntPipe) id: number, @Body() body: PatchBody): Promise<VehicleVM> {
    const patch: DevicePatch = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.plate !== undefined) patch.plate = body.plate;
    if (body.type !== undefined) patch.type = body.type;
    if (body.iconKey !== undefined) patch.icon_key = body.iconKey;
    if (body.sim !== undefined) patch.sim_operator = body.sim;
    if (body.phone !== undefined) patch.sim_phone = body.phone;
    return this.vehicles.patch(id, patch);
  }
}
