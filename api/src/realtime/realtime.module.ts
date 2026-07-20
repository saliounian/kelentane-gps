import { Module } from "@nestjs/common";
import { TraccarModule } from "../traccar/traccar.module";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AlarmsModule } from "../alarms/alarms.module";
import { TraccarRealtimeService } from "./traccar-realtime.service";
import { PositionsGateway } from "./positions.gateway";
import { AlarmPushBridge } from "./alarm-push.bridge";
import { AlarmRecipientsService } from "./alarm-recipients.service";
import { AnomalyPushMonitor } from "./anomaly-push.monitor";

@Module({
  imports: [TraccarModule, VehiclesModule, NotificationsModule, AlarmsModule],
  providers: [TraccarRealtimeService, PositionsGateway, AlarmPushBridge, AlarmRecipientsService, AnomalyPushMonitor],
})
export class RealtimeModule {}
