import { Body, Controller, Get, HttpException, HttpStatus, Post, Query } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { DevicesService } from "../supabase/devices.service";

const genericBad = () =>
  new HttpException({ message: "IMEI ou mot de passe incorrect", code: "bad_credentials" }, HttpStatus.UNAUTHORIZED);

@Controller("auth")
export class AuthController {
  constructor(
    private readonly supa: SupabaseService,
    private readonly devices: DevicesService,
  ) {}

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

  /**
   * POST /auth/imei-login { imei, password } → { accessToken, refreshToken }.
   * Login par IMEI routé via l'API pour appliquer le RATE-LIMIT par IMEI (§3.5,
   * partagé avec l'ajout de device). Le mobile pose la session via setSession.
   * Erreur générique unique (anti-énumération) ; 429 si rate-limité.
   */
  @Post("imei-login")
  async imeiLogin(@Body() body: { imei?: string; password?: string }): Promise<{ accessToken: string; refreshToken: string }> {
    const imei = (body?.imei ?? "").replace(/\s/g, "");
    const password = body?.password ?? "";
    if (!/^\d{10,17}$/.test(imei) || !password) throw genericBad();

    if (await this.devices.loginBlocked(imei)) {
      throw new HttpException(
        { message: "Trop de tentatives. Réessaie dans 15 minutes.", code: "rate_limited" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const session = await this.supa.passwordSignIn(`${imei}@kelentane.com`, password);
    await this.devices.loginBump(imei, !!session); // succès → reset ; échec → +1
    if (!session) throw genericBad();
    return session;
  }
}
