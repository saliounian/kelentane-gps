import { Module } from "@nestjs/common";
import { TraccarModule } from "../traccar/traccar.module";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { TraccarRealtimeService } from "./traccar-realtime.service";
import { PositionsGateway } from "./positions.gateway";

@Module({
  imports: [TraccarModule, VehiclesModule],
  providers: [TraccarRealtimeService, PositionsGateway],
})
export class RealtimeModule {}
