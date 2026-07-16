import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

export interface NotificationPrefs {
  armed: boolean;
  types: Record<string, boolean>;
}

/**
 * Préférences de notification + jetons push, rattachés au COMPTE RÉEL du client
 * (client_id = userId issu du JWT). Isolation : chaque utilisateur ne lit/écrit
 * que ses propres prefs/jetons (RLS self + filtrage explicite par userId ici).
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(private readonly supa: SupabaseService) {}

  async getPrefs(userId: string): Promise<NotificationPrefs> {
    if (!this.supa.client) return { armed: true, types: {} };
    const { data } = await this.supa.client
      .from("notification_prefs")
      .select("armed,types")
      .eq("client_id", userId)
      .maybeSingle();
    if (!data) return { armed: true, types: {} };
    return { armed: data.armed as boolean, types: (data.types as Record<string, boolean>) ?? {} };
  }

  async patchPrefs(userId: string, patch: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    if (!this.supa.client) return { armed: patch.armed ?? true, types: patch.types ?? {} };
    const current = await this.getPrefs(userId);
    const next: NotificationPrefs = {
      armed: patch.armed ?? current.armed,
      types: { ...current.types, ...(patch.types ?? {}) },
    };
    const { error } = await this.supa.client
      .from("notification_prefs")
      .upsert({ client_id: userId, armed: next.armed, types: next.types }, { onConflict: "client_id" });
    if (error) this.log.error(`patchPrefs: ${error.message}`);
    return next;
  }

  /** Enregistre un jeton push pour le compte. L'ENVOI réel est géré par PushService. */
  async registerToken(userId: string, token: string, platform: string): Promise<{ stored: boolean }> {
    if (!this.supa.client) {
      this.log.warn("registerToken ignoré (Supabase désactivé)");
      return { stored: false };
    }
    const { error } = await this.supa.client
      .from("push_tokens")
      .upsert({ client_id: userId, token, platform }, { onConflict: "token" });
    if (error) {
      this.log.error(`registerToken: ${error.message}`);
      return { stored: false };
    }
    return { stored: true };
  }
}
