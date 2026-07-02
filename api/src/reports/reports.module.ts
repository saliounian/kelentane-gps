import { Module } from "@nestjs/common";
import { TraccarModule } from "../traccar/traccar.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [TraccarModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
