import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CommandsModule } from "./commands/commands.module";
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
