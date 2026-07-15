import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur (service_role — SECRET, jamais côté mobile).
 * Optionnel : si la clé est absente, `client` = null et les champs métier /
 * la persistance sont désactivés (l'app fonctionne en dégradé sur Traccar seul).
 */
@Injectable()
export class SupabaseService {
  private readonly log = new Logger(SupabaseService.name);
  readonly client: SupabaseClient | null;
  private readonly url?: string;
  private readonly publishableKey?: string;

  constructor(config: ConfigService) {
    this.url = config.get<string>("SUPABASE_URL");
    this.publishableKey = config.get<string>("SUPABASE_PUBLISHABLE_KEY");
    const key = config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (this.url && key && key !== "change-me-secret") {
      this.client = createClient(this.url, key, { auth: { persistSession: false } });
    } else {
      this.client = null;
      this.log.warn("SUPABASE_SERVICE_ROLE_KEY absent — champs métier & persistance désactivés");
    }
  }

  /** Résout l'utilisateur depuis un JWT `Authorization: Bearer` (valide la signature). */
  async getUserFromToken(authHeader?: string): Promise<{ id: string; email: string } | null> {
    if (!this.client || !authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  }

  /** Vérifie un mot de passe contre le compte (client publishable éphémère). */
  async verifyPassword(email: string, password: string): Promise<boolean> {
    if (!this.url || !this.publishableKey) return false;
    const c = createClient(this.url, this.publishableKey, { auth: { persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email, password });
    return !error;
  }

  /**
   * Connexion serveur (client publishable éphémère) → renvoie les tokens de session
   * pour que le mobile les pose via `setSession`. Sert au login IMEI routé par l'API
   * (rate-limit). Retourne null si identifiants invalides.
   */
  async passwordSignIn(email: string, password: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    if (!this.url || !this.publishableKey) return null;
    const c = createClient(this.url, this.publishableKey, { auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error || !data.session) return null;
    return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token };
  }

  /**
   * Crée un compte auth (service_role, email pré-confirmé car identité synthétique).
   * Retourne l'id créé, ou null si indisponible / déjà existant. Le trigger
   * handle_new_user crée la ligne clients associée.
   */
  async createAuthUser(email: string, password: string): Promise<string | null> {
    if (!this.client) {
      this.log.error(`createAuthUser ${email}: client service_role indisponible (SUPABASE_SERVICE_ROLE_KEY ?)`);
      return null;
    }
    const { data, error } = await this.client.auth.admin.createUser({ email, password, email_confirm: true });
    if (!error && data?.user) return data.user.id;

    // Idempotence : compte déjà présent → résoudre l'id existant plutôt qu'échouer.
    const code = (error as { code?: string; status?: number } | null)?.code;
    const already = code === "email_exists" || /already been registered|already exists/i.test(error?.message ?? "");
    if (already) {
      const existing = await this.findUserIdByEmail(email);
      if (existing) return existing;
    }
    // Ne pas avaler : erreur réelle remontée en niveau ERROR (visible en prod).
    this.log.error(`createAuthUser ${email}: ${error?.message ?? "échec inconnu"}${code ? ` [${code}]` : ""}`);
    return null;
  }

  /** Résout l'id d'un compte auth par email (idempotence walk-up §2). */
  async findUserIdByEmail(email: string): Promise<string | null> {
    if (!this.client) return null;
    const target = email.trim().toLowerCase();
    // Base de comptes réduite → pagination courte suffit (perPage max GoTrue = 200).
    for (let page = 1; page <= 25; page++) {
      const { data, error } = await this.client.auth.admin.listUsers({ page, perPage: 200 });
      if (error) {
        this.log.error(`findUserIdByEmail ${email}: ${error.message}`);
        return null;
      }
      const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
      if (hit) return hit.id;
      if (data.users.length < 200) break; // dernière page atteinte
    }
    return null;
  }

  /** Supprime un compte auth (la ligne clients + accès cascadent via FK). */
  async deleteAuthUser(userId: string): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error) this.log.error(`deleteAuthUser ${userId}: ${error.message}`);
  }
}
