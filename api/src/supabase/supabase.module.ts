import { Global, Module } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";
import { DevicesService } from "./devices.service";
import { AccessService } from "./access.service";
import { AuthGuard } from "../auth/auth.guard";

@Global()
@Module({
  providers: [SupabaseService, DevicesService, AccessService, AuthGuard],
  exports: [SupabaseService, DevicesService, AccessService, AuthGuard],
})
export class SupabaseModule {}
