import { Global, Module } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";
import { DevicesService } from "./devices.service";

@Global()
@Module({
  providers: [SupabaseService, DevicesService],
  exports: [SupabaseService, DevicesService],
})
export class SupabaseModule {}
