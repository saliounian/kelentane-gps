import { Module } from "@nestjs/common";
import { TraccarModule } from "../traccar/traccar.module";
import { CommandsController } from "./commands.controller";
import { CommandsService } from "./commands.service";

@Module({
  imports: [TraccarModule],
  controllers: [CommandsController],
  providers: [CommandsService],
})
export class CommandsModule {}
