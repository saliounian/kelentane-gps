import { Controller, Get, HttpException, HttpStatus, UseGuards } from "@nestjs/common";
import { AlarmsService } from "./alarms.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user";
import type { AlarmEventVM, DeviceHealthVM } from "./alarms.types";

@Controller("alarms")
@UseGuards(AuthGuard)
export class AlarmsController {
  constructor(private readonly alarms: AlarmsService) {}

  /** GET /alarms/events → événements récents du client (§6.3). */
  @Get("events")
  async events(@CurrentUser() user: AuthUser): Promise<AlarmEventVM[]> {
    try {
      return await this.alarms.events(user.id);
    } catch {
      throw new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
    }
  }

  /** GET /alarms/anomalies → santé dispositif du client (§6.4). */
  @Get("anomalies")
  async anomalies(@CurrentUser() user: AuthUser): Promise<DeviceHealthVM[]> {
    try {
      return await this.alarms.anomalies(user.id);
    } catch {
      throw new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
    }
  }
}
