import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { VehiclesService } from "./vehicles.service";
import type { VehicleVM } from "./vehicle.vm";

@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  /** GET /vehicles → view-model §6.1. 502 si le cœur Traccar est injoignable. */
  @Get()
  async list(): Promise<VehicleVM[]> {
    try {
      return await this.vehicles.list();
    } catch {
      throw new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
    }
  }
}
