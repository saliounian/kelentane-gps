import { Module } from "@nestjs/common";
import { TraccarModule } from "../traccar/traccar.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminGuard } from "../auth/admin.guard";

/**
 * Administration plateforme (§admin). SupabaseService / DevicesService / AccountsService
 * sont globaux (SupabaseModule) ; TraccarService vient de TraccarModule (bulk-enroll, purge).
 */
@Module({
  imports: [TraccarModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
