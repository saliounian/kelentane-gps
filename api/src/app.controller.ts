import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Sonde de vivacité de l'API façade. */
  @Get("health")
  health(): { status: string; service: string } {
    return { status: "ok", service: "kelentane-api" };
  }
}
