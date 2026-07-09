import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { TraccarService } from "../traccar/traccar.service";
import { DevicesService } from "../supabase/devices.service";
import { SupabaseService } from "../supabase/supabase.service";
import { AccessService } from "../supabase/access.service";
import { areaToWkt, type CreateGeofenceBody, type GeofenceArea, type GeofenceVM } from "./geofences.types";

interface GeoRow {
  id: string;
  device_id: string;
  traccar_geofence_id: number | null;
  name: string;
  kind: "circle" | "polygon";
  area: GeofenceArea | null;
  color: string | null;
  enabled: boolean;
}

@Injectable()
export class GeofencesService {
  constructor(
    private readonly traccar: TraccarService,
    private readonly devices: DevicesService,
    private readonly supa: SupabaseService,
    private readonly access: AccessService,
  ) {}

  private requireSupa() {
    if (!this.supa.client) throw new ServiceUnavailableException("Base app indisponible");
    return this.supa.client;
  }

  /** Résout un véhicule (id Traccar) → { traccarId, deviceRowId } après contrôle d'accès. */
  private async resolveDevice(vehicleId: number, userId: string): Promise<{ traccarId: number; deviceRowId: string }> {
    const { devices } = await this.traccar.getFleet();
    const d = devices.find((x) => x.id === vehicleId);
    if (!d) throw new NotFoundException("Véhicule introuvable");
    const allowed = await this.access.allowed(userId);
    this.access.assertImei(allowed, d.uniqueId);
    const row = await this.devices.upsertByImei(d.uniqueId, d.id, userId, {});
    if (!row) throw new ServiceUnavailableException("Base app indisponible");
    return { traccarId: d.id, deviceRowId: row.id };
  }

  async list(vehicleId: number, userId: string): Promise<GeofenceVM[]> {
    const client = this.requireSupa();
    const { deviceRowId } = await this.resolveDevice(vehicleId, userId);
    const { data, error } = await client
      .from("custom_geofences")
      .select("id,device_id,traccar_geofence_id,name,kind,area,color,enabled")
      .eq("device_id", deviceRowId)
      .order("created_at", { ascending: false });
    if (error) throw new ServiceUnavailableException(error.message);
    return (data as GeoRow[]).map((r) => this.toVM(r));
  }

  async create(vehicleId: number, body: CreateGeofenceBody, userId: string): Promise<GeofenceVM> {
    const client = this.requireSupa();
    const { traccarId, deviceRowId } = await this.resolveDevice(vehicleId, userId);

    const geo = await this.traccar.createGeofence(body.name, areaToWkt(body.area));
    await this.traccar.linkGeofence(traccarId, geo.id); // active la règle enter/exit

    const { data, error } = await client
      .from("custom_geofences")
      .insert({
        device_id: deviceRowId,
        traccar_geofence_id: geo.id,
        name: body.name,
        kind: body.kind,
        area: body.area,
        color: body.color ?? null,
        enabled: true,
      })
      .select("id,device_id,traccar_geofence_id,name,kind,area,color,enabled")
      .single();
    if (error) throw new ServiceUnavailableException(error.message);
    return this.toVM(data as GeoRow);
  }

  async patch(geofenceId: string, patch: { enabled?: boolean; name?: string }, userId: string): Promise<GeofenceVM> {
    const client = this.requireSupa();
    const row = await this.getRow(geofenceId);
    await this.assertRowAccess(userId, row.device_id);

    // Activer/désactiver = lier/délier la permission Traccar (la règle s'arrête).
    if (patch.enabled !== undefined && patch.enabled !== row.enabled && row.traccar_geofence_id) {
      const traccarId = await this.traccarIdOfDevice(row.device_id);
      if (traccarId) {
        if (patch.enabled) await this.traccar.linkGeofence(traccarId, row.traccar_geofence_id);
        else await this.traccar.unlinkGeofence(traccarId, row.traccar_geofence_id);
      }
    }

    const { data, error } = await client
      .from("custom_geofences")
      .update({ ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}), ...(patch.name ? { name: patch.name } : {}) })
      .eq("id", geofenceId)
      .select("id,device_id,traccar_geofence_id,name,kind,area,color,enabled")
      .single();
    if (error) throw new ServiceUnavailableException(error.message);
    return this.toVM(data as GeoRow);
  }

  async remove(geofenceId: string, userId: string): Promise<{ deleted: true }> {
    const client = this.requireSupa();
    const row = await this.getRow(geofenceId);
    await this.assertRowAccess(userId, row.device_id);
    if (row.traccar_geofence_id) {
      try {
        await this.traccar.deleteGeofence(row.traccar_geofence_id);
      } catch {
        /* déjà absente côté Traccar : on nettoie quand même l'app */
      }
    }
    const { error } = await client.from("custom_geofences").delete().eq("id", geofenceId);
    if (error) throw new ServiceUnavailableException(error.message);
    return { deleted: true };
  }

  /** Vérifie que le device de la géofence appartient au périmètre du client. */
  private async assertRowAccess(userId: string, deviceRowId: string): Promise<void> {
    const allowed = await this.access.allowed(userId);
    if (!allowed.rowIds.has(deviceRowId)) throw new ForbiddenException("Accès refusé à cette géofence");
  }

  private async getRow(id: string): Promise<GeoRow> {
    const client = this.requireSupa();
    const { data, error } = await client
      .from("custom_geofences")
      .select("id,device_id,traccar_geofence_id,name,kind,area,color,enabled")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException(error.message);
    if (!data) throw new NotFoundException("Géofence introuvable");
    return data as GeoRow;
  }

  private async traccarIdOfDevice(deviceRowId: string): Promise<number | null> {
    const client = this.requireSupa();
    const { data } = await client.from("devices").select("traccar_id").eq("id", deviceRowId).maybeSingle();
    return (data?.traccar_id as number | null) ?? null;
  }

  private toVM(r: GeoRow): GeofenceVM {
    return { id: r.id, name: r.name, kind: r.kind, color: r.color, enabled: r.enabled, area: r.area };
  }
}
