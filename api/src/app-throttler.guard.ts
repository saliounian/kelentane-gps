import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * ThrottlerGuard global (APP_GUARD) — n'agit QUE sur les requêtes HTTP.
 * Les WebSockets (PositionsGateway) ont leur propre cycle de connexion et ne
 * doivent pas être comptées dans le même compteur par IP/minute.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    return super.shouldSkip(context);
  }
}
