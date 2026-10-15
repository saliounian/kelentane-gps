import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

/**
 * Lecture directe de `clients.is_admin` via le client service_role. Logique
 * UNIQUE partagée par AdminGuard et tout appelant interne (ex. VehiclesService
 * avant création d'un IMEI neuf) — un seul endroit qui décide qui est admin.
 */
export async function isAdminUser(supa: SupabaseService, userId: string): Promise<boolean> {
  if (!supa.client) return false;
  const { data } = await supa.client.from("clients").select("is_admin").eq("id", userId).maybeSingle();
  return !!data && (data as { is_admin: boolean }).is_admin === true;
}

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
    if (!uid || !(await isAdminUser(this.supa, uid))) {
      throw new ForbiddenException("Accès administrateur requis.");
    }
    return true;
  }
}
