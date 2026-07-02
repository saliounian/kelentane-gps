import { Controller, Get, Query } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly supa: SupabaseService) {}

  /**
   * GET /auth/username-available?u= → { available }.
   * Vérifie l'unicité du username (RLS empêche le mobile de lire les autres
   * clients ; ce check passe par le service_role côté serveur).
   */
  @Get("username-available")
  async available(@Query("u") u?: string): Promise<{ available: boolean }> {
    const username = (u ?? "").trim();
    if (!username || !this.supa.client) return { available: false };
    const { data, error } = await this.supa.client
      .from("clients")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (error) return { available: false };
    return { available: !data };
  }
}
