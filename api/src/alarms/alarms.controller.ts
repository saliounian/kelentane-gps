import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { AlarmsService } from "./alarms.service";
import type { AlarmEventVM, DeviceHealthVM } from "./alarms.types";

@Controller("alarms")
export class AlarmsController {
  constructor(private readonly alarms: AlarmsService) {}

  /** GET /alarms/events → événements récents (§6.3). */
  @Get("events")
  async events(): Promise<AlarmEventVM[]> {
    try {
      return await this.alarms.events();
    } catch {
      throw new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
    }
  }

  /** GET /alarms/anomalies → santé dispositif calculée (§6.4). */
  @Get("anomalies")
  async anomalies(): Promise<DeviceHealthVM[]> {
    try {
      return await this.alarms.anomalies();
    } catch {
      throw new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
    }
  }
}
