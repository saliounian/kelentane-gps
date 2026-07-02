import { Module } from "@nestjs/common";
import { TraccarModule } from "../traccar/traccar.module";
import { SharesController } from "./shares.controller";
import { SharesService } from "./shares.service";

@Module({
  imports: [TraccarModule],
  controllers: [SharesController],
  providers: [SharesService],
})
export class SharesModule {}
