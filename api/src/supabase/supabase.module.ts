import { Global, Module } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";
import { DevicesService } from "./devices.service";
import { AccessService } from "./access.service";
import { AccountsService } from "./accounts.service";
import { AuthGuard } from "../auth/auth.guard";

@Global()
@Module({
  providers: [SupabaseService, DevicesService, AccessService, AccountsService, AuthGuard],
  exports: [SupabaseService, DevicesService, AccessService, AccountsService, AuthGuard],
})
export class SupabaseModule {}
