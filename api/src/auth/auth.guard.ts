import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

/** Exige un JWT Supabase valide ; attache request.user = { id, email }. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supa: SupabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const user = await this.supa.getUserFromToken(req.headers["authorization"]);
    if (!user) throw new UnauthorizedException("Authentification requise");
    req.user = user;
    return true;
  }
}
