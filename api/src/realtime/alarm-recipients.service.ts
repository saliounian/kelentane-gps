import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { DevicesService } from "../supabase/devices.service";

/**
 * Résolution des DESTINATAIRES d'une alarme : tous les comptes ayant un accès
 * ACTIF au device (`device_access`). Partagé par le pont d'événements temps réel
 * et le moniteur d'anomalies pour qu'ils routent exactement de la même façon.
 */
@Injectable()
export class AlarmRecipientsService {
  private readonly log = new Logger(AlarmRecipientsService.name);

  constructor(
    private readonly devices: DevicesService,
    private readonly supa: SupabaseService,
  ) {}

  async usersForImei(imei: string): Promise<string[]> {
    const row = await this.devices.getRowByImei(imei);
    if (!row || !this.supa.client) return [];
    const { data, error } = await this.supa.client
      .from("device_access")
      .select("user_id")
      .eq("device_id", row.id)
      .eq("status", "active");
    if (error) {
      this.log.error(`usersForImei ${imei}: ${error.message}`);
      return [];
    }
    return (data ?? []).map((r) => r.user_id as string);
  }
}
