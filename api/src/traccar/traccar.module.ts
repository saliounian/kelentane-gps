import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TraccarService } from "./traccar.service";

@Module({
  imports: [HttpModule],
  providers: [TraccarService],
  exports: [TraccarService],
})
export class TraccarModule {}
