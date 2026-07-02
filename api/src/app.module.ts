import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AlarmsModule } from "./alarms/alarms.module";
import { AuthModule } from "./auth/auth.module";
import { CommandsModule } from "./commands/commands.module";
import { GeofencesModule } from "./geofences/geofences.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ReportsModule } from "./reports/reports.module";
import { SharesModule } from "./shares/shares.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { TraccarModule } from "./traccar/traccar.module";
import { VehiclesModule } from "./vehicles/vehicles.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env"] }),
    SupabaseModule,
    TraccarModule,
    VehiclesModule,
    CommandsModule,
    AlarmsModule,
    NotificationsModule,
    ReportsModule,
    GeofencesModule,
    AuthModule,
    SharesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
