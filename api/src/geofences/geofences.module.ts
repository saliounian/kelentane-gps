import { Module } from "@nestjs/common";
import { TraccarModule } from "../traccar/traccar.module";
import { GeofencesController } from "./geofences.controller";
import { GeofencesService } from "./geofences.service";

@Module({
  imports: [TraccarModule],
  controllers: [GeofencesController],
  providers: [GeofencesService],
})
export class GeofencesModule {}
