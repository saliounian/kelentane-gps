import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";

export interface NotificationPrefs {
  armed: boolean;
  types: Record<string, boolean>;
}

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private readonly seedOwner: string;

  constructor(
    private readonly supa: SupabaseService,
    config: ConfigService,
  ) {
    this.seedOwner = config.get<string>("SEED_OWNER_ID") ?? "000000aa-0000-0000-0000-0000000000aa";
  }

  async getPrefs(): Promise<NotificationPrefs> {
    if (!this.supa.client) return { armed: true, types: {} };
    const { data } = await this.supa.client
      .from("notification_prefs")
      .select("armed,types")
      .eq("client_id", this.seedOwner)
      .maybeSingle();
    if (!data) return { armed: true, types: {} };
    return { armed: data.armed as boolean, types: (data.types as Record<string, boolean>) ?? {} };
  }

  async patchPrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    if (!this.supa.client) return { armed: patch.armed ?? true, types: patch.types ?? {} };
    const current = await this.getPrefs();
    const next: NotificationPrefs = {
      armed: patch.armed ?? current.armed,
      types: { ...current.types, ...(patch.types ?? {}) },
    };
    const { error } = await this.supa.client
      .from("notification_prefs")
      .upsert({ client_id: this.seedOwner, armed: next.armed, types: next.types }, { onConflict: "client_id" });
    if (error) this.log.error(`patchPrefs: ${error.message}`);
    return next;
  }

  /**
   * Enregistre un jeton push. L'ENVOI réel (FCM/APNs/Expo) est différé : il
   * nécessite des credentials projet — voir docs/PLAN.md. Ici on stocke seulement.
   */
  async registerToken(token: string, platform: string): Promise<{ stored: boolean }> {
    if (!this.supa.client) {
      this.log.warn("registerToken ignoré (Supabase désactivé)");
      return { stored: false };
    }
    const { error } = await this.supa.client
      .from("push_tokens")
      .upsert({ client_id: this.seedOwner, token, platform }, { onConflict: "token" });
    if (error) {
      this.log.error(`registerToken: ${error.message}`);
      return { stored: false };
    }
    return { stored: true };
  }
}
