import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import { NotificationsService } from "./notifications.service";

export interface PushMessage {
  title: string;
  body: string;
  /** Type d'alarme (id ALARM_TYPES) pour filtrer selon les préférences. */
  type?: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  sent: number;
  skipped?: string;
}

/**
 * Envoi de notifications push via l'API Expo Push (les jetons de l'app sont des
 * ExponentPushToken ; Expo route ensuite vers FCM/APNs selon les credentials
 * configurés dans EAS).
 *
 * ⚠️ DÉSACTIVÉ tant que `PUSH_ENABLED=true` n'est pas mis (et credentials EAS
 * FCM/APNs fournis). Structure prête, aucun envoi réel sinon. Voir docs/PUSH.md.
 */
@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);
  private readonly enabled: boolean;
  private readonly accessToken?: string;

  constructor(
    private readonly supa: SupabaseService,
    private readonly notifs: NotificationsService,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>("PUSH_ENABLED") === "true";
    this.accessToken = config.get<string>("EXPO_ACCESS_TOKEN") || undefined;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Envoie une notif au compte, en respectant ses préférences (armed + par type).
   * À appeler depuis le futur moteur d'alarmes (non branché pour l'instant).
   */
  async sendToUser(userId: string, msg: PushMessage): Promise<PushResult> {
    if (!this.enabled) return { sent: 0, skipped: "PUSH_ENABLED=false" };
    if (!this.supa.client) return { sent: 0, skipped: "supabase désactivé" };

    const prefs = await this.notifs.getPrefs(userId);
    if (!prefs.armed) return { sent: 0, skipped: "notifications désarmées" };
    if (msg.type && prefs.types[msg.type] === false) return { sent: 0, skipped: `type ${msg.type} désactivé` };

    const { data: toks, error } = await this.supa.client
      .from("push_tokens")
      .select("token")
      .eq("client_id", userId);
    if (error) {
      this.log.error(`lecture tokens: ${error.message}`);
      return { sent: 0, skipped: "erreur tokens" };
    }
    const tokens = (toks ?? []).map((r) => r.token as string).filter((t) => /^Expo(nent)?PushToken\[/.test(t));
    if (tokens.length === 0) return { sent: 0, skipped: "aucun jeton" };

    let sent = 0;
    const dead: string[] = [];
    // Expo limite à 100 messages par requête → on découpe.
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);
      const messages = batch.map((to) => ({ to, title: msg.title, body: msg.body, sound: "default", data: msg.data ?? {} }));
      try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
          },
          body: JSON.stringify(messages),
        });
        if (!res.ok) {
          this.log.error(`Expo push ${res.status}`);
          continue;
        }
        // Chaque ticket correspond (dans l'ordre) à un jeton du batch. Un ticket
        // en erreur DeviceNotRegistered = jeton mort → on le purge (hygiène tokens).
        const body = (await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
        const tickets = body.data ?? [];
        batch.forEach((tok, idx) => {
          const t = tickets[idx];
          if (t?.status === "ok") sent += 1;
          else if (t?.details?.error === "DeviceNotRegistered") dead.push(tok);
        });
      } catch (e) {
        this.log.error(`Expo push: ${(e as Error).message}`);
      }
    }

    if (dead.length > 0) {
      const { error: delErr } = await this.supa.client.from("push_tokens").delete().eq("client_id", userId).in("token", dead);
      if (delErr) this.log.error(`purge tokens morts: ${delErr.message}`);
      else this.log.log(`${dead.length} jeton(s) mort(s) purgé(s) pour ${userId}`);
    }

    return { sent, skipped: sent === 0 ? "aucun envoi réussi" : undefined };
  }
}
