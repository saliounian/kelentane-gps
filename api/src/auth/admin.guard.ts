import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

/**
 * Exige que l'utilisateur courant (résolu par AuthGuard → request.user) soit
 * administrateur (clients.is_admin = true). À utiliser APRÈS AuthGuard :
 *   @UseGuards(AuthGuard, AdminGuard)
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly supa: SupabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ user?: { id: string } }>();
    const uid = req.user?.id;
    if (!uid || !this.supa.client) throw new ForbiddenException("Accès administrateur requis.");

    const { data } = await this.supa.client.from("clients").select("is_admin").eq("id", uid).maybeSingle();
    if (!data || (data as { is_admin: boolean }).is_admin !== true) {
      throw new ForbiddenException("Accès administrateur requis.");
    }
    return true;
  }
}
