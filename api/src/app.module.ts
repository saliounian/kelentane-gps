import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AppThrottlerGuard } from "./app-throttler.guard";
import { AlarmsModule } from "./alarms/alarms.module";
import { AuthModule } from "./auth/auth.module";
import { CommandsModule } from "./commands/commands.module";
import { GeofencesModule } from "./geofences/geofences.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ReportsModule } from "./reports/reports.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { SharesModule } from "./shares/shares.module";
import { SubaccountsModule } from "./subaccounts/subaccounts.module";
import { AdminModule } from "./admin/admin.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { TraccarModule } from "./traccar/traccar.module";
import { VehiclesModule } from "./vehicles/vehicles.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env"] }),
    // Rate-limit global : 120 req/min/IP par défaut (surchargé par route via @Throttle).
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
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
    SubaccountsModule,
    AdminModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
