import { Module } from "@nestjs/common";
import { SubaccountsController } from "./subaccounts.controller";
import { SubaccountsService } from "./subaccounts.service";

/** §4 — sous-comptes / délégation. SupabaseService & DevicesService sont globaux. */
@Module({
  controllers: [SubaccountsController],
  providers: [SubaccountsService],
})
export class SubaccountsModule {}
