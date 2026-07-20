import { Module } from "@nestjs/common";
import { TraccarModule } from "../traccar/traccar.module";
import { AlarmsController } from "./alarms.controller";
import { AlarmsService } from "./alarms.service";

@Module({
  imports: [TraccarModule],
  controllers: [AlarmsController],
  providers: [AlarmsService],
  exports: [AlarmsService],
})
export class AlarmsModule {}
