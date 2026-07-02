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
}
