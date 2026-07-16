import { Module } from "@nestjs/common";
import { TraccarModule } from "../traccar/traccar.module";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TraccarRealtimeService } from "./traccar-realtime.service";
import { PositionsGateway } from "./positions.gateway";
import { AlarmPushBridge } from "./alarm-push.bridge";

@Module({
  imports: [TraccarModule, VehiclesModule, NotificationsModule],
  providers: [TraccarRealtimeService, PositionsGateway, AlarmPushBridge],
})
export class RealtimeModule {}
