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

  constructor(config: ConfigService) {
    const url = config.get<string>("SUPABASE_URL");
    const key = config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key && key !== "change-me-secret") {
      this.client = createClient(url, key, { auth: { persistSession: false } });
    } else {
      this.client = null;
      this.log.warn("SUPABASE_SERVICE_ROLE_KEY absent — champs métier & persistance désactivés");
    }
  }
}
