import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseService } from "../supabase/supabase.service";
import { DevicesService } from "../supabase/devices.service";
import { AccountsService } from "../supabase/accounts.service";
import { TraccarService } from "../traccar/traccar.service";
import type {
  AdminClientView,
  AdminDevice,
  BulkEnrollResult,
  PromoteResult,
  PurgeCandidate,
  PurgeResult,
  TransferResult,
} from "./admin.types";

const BULK_MAX = 200;
const BULK_CONCURRENCY = 4;

/** Motifs d'IMEI de test (purge). Un vrai IMEI = exactement 15 chiffres. */
function isTestImei(imei: string): boolean {
  return imei === "1234567890" || imei.startsWith("868000000000") || !/^\d{15}$/.test(imei);
}

@Injectable()
export class AdminService {
  private readonly log = new Logger(AdminService.name);

  constructor(
    private readonly supa: SupabaseService,
    private readonly devices: DevicesService,
    private readonly accounts: AccountsService,
    private readonly traccar: TraccarService,
  ) {}

  private client(): SupabaseClient {
    const c = this.supa.client;
    if (!c) throw new ServiceUnavailableException("Base indisponible");
    return c;
  }

  /** Résout un username → { id, username } (insensible à la casse). */
  private async resolveUser(username: string): Promise<{ id: string; username: string | null } | null> {
    const { data } = await this.client()
      .from("clients")
      .select("id, username")
      .ilike("username", username.trim())
      .maybeSingle();
    return (data as { id: string; username: string | null } | null) ?? null;
  }

  // ─── ENDPOINT 1 — GET /admin/devices ────────────────────────────────────────
  async listDevices(): Promise<AdminDevice[]> {
    const c = this.client();
    const { data: devices, error } = await c
      .from("devices")
      .select("id, imei, name, traccar_id, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new ServiceUnavailableException(error.message);

    const { data: access } = await c.from("device_access").select("device_id, status");
    const active = new Map<string, number>();
    const revalidate = new Map<string, number>();
    for (const a of (access ?? []) as { device_id: string; status: string }[]) {
      const bucket = a.status === "active" ? active : a.status === "revalidate" ? revalidate : null;
      if (bucket) bucket.set(a.device_id, (bucket.get(a.device_id) ?? 0) + 1);
    }

    return ((devices ?? []) as { id: string; imei: string; name: string | null; traccar_id: number | null; created_at: string }[]).map(
      (d) => ({
        id: d.id,
        imei: d.imei,
        name: d.name,
        traccarId: d.traccar_id,
        activeCount: active.get(d.id) ?? 0,
        revalidateCount: revalidate.get(d.id) ?? 0,
        createdAt: d.created_at,
      }),
    );
  }

  // ─── ENDPOINT 2 — POST /admin/devices/:id/reset-password ─────────────────────
  /** Reset admin via RPC device_admin_reset_password (traccar_id). false = device introuvable. */
  async adminResetPassword(traccarId: number, adminId: string, newPassword: string): Promise<boolean> {
    const { data, error } = await this.client().rpc("device_admin_reset_password", {
      p_traccar_id: traccarId,
      p_admin: adminId,
      p_new: newPassword,
    });
    if (error) {
      this.log.error(`device_admin_reset_password ${traccarId}: ${error.message}`);
      throw new ServiceUnavailableException(error.message);
    }
    return data === true;
  }

  // ─── ENDPOINT 3 — POST /admin/devices/bulk-enroll ────────────────────────────
  async bulkEnroll(imeis: string[], adminId: string): Promise<BulkEnrollResult[]> {
    // Snapshot Traccar une seule fois (évite N appels ; createDevice y ajoute au fil de l'eau).
    let fleet: { id: number; uniqueId: string }[] = [];
    try {
      fleet = (await this.traccar.getFleet()).devices;
    } catch {
      return imeis.map((imei) => ({ imei, status: "error" as const, message: "Cœur GPS injoignable" }));
    }
    const traccarByImei = new Map(fleet.map((d) => [d.uniqueId, d.id]));

    const enrollOne = async (raw: string): Promise<BulkEnrollResult> => {
      const imei = raw.replace(/\s/g, "");
      try {
        if (!/^\d{10,17}$/.test(imei)) return { imei, status: "error", message: "IMEI invalide" };
        if (await this.devices.existsByImei(imei)) return { imei, status: "exists" };

        const label = `Boîtier ${imei.slice(-4)}`;
        const traccarId = traccarByImei.get(imei) ?? (await this.traccar.createDevice(label, imei)).id;
        await this.devices.upsertByImei(imei, traccarId, adminId, { name: label });

        // Provisioning walk-up (compte IMEI + accès action) — idempotent, non bloquant.
        try {
          await this.accounts.ensureDeviceAccount(imei);
        } catch (e) {
          this.log.warn(`walk-up ${imei}: ${(e as Error).message}`);
        }
        return { imei, status: "created" };
      } catch (e) {
        return { imei, status: "error", message: (e as Error).message };
      }
    };

    // Lots concurrents (BULK_CONCURRENCY en parallèle), ordre global préservé.
    const out: BulkEnrollResult[] = [];
    for (let i = 0; i < imeis.length; i += BULK_CONCURRENCY) {
      const chunk = imeis.slice(i, i + BULK_CONCURRENCY);
      out.push(...(await Promise.all(chunk.map(enrollOne))));
    }
    return out;
  }

  static validateBulk(imeis: unknown): string[] {
    if (!Array.isArray(imeis) || imeis.some((x) => typeof x !== "string")) {
      throw new BadRequestException("Body attendu : { imeis: string[] }");
    }
    if (imeis.length === 0) throw new BadRequestException("Aucun IMEI fourni.");
    if (imeis.length > BULK_MAX) throw new BadRequestException(`Maximum ${BULK_MAX} IMEI par appel.`);
    return imeis as string[];
  }

  // ─── ENDPOINT 4 — POST /admin/devices/transfer ───────────────────────────────
  async transfer(imei: string, fromUsername: string, toUsername: string): Promise<TransferResult> {
    const c = this.client();
    const from = await this.resolveUser(fromUsername);
    if (!from) throw new NotFoundException("Compte source introuvable.");
    const to = await this.resolveUser(toUsername);
    if (!to) throw new NotFoundException("Compte destination introuvable.");

    const row = await this.devices.getRowByImei(imei);
    if (!row) throw new NotFoundException("Dispositif introuvable.");

    const { data: acc } = await c
      .from("device_access")
      .select("id")
      .eq("device_id", row.id)
      .eq("user_id", from.id)
      .eq("status", "active")
      .maybeSingle();
    if (!acc) throw new NotFoundException("Aucun accès trouvé pour ce compte sur ce device.");

    // Pas de transaction multi-requête via l'API REST Supabase. On accorde d'ABORD
    // le destinataire (idempotent), PUIS on retire la source : en cas d'échec au
    // milieu, l'accès n'est jamais totalement perdu (récupérable), jamais dupliqué durablement.
    await this.devices.insertAccess(row.id, to.id, "action");
    await this.devices.removeAccessByImei(imei, from.id);

    return { transferred: true, imei, from: fromUsername, to: toUsername };
  }

  // ─── ENDPOINT 5 — GET /admin/clients/:username ───────────────────────────────
  async getClient(username: string): Promise<AdminClientView> {
    const c = this.client();
    const { data: cli } = await c
      .from("clients")
      .select("id, name, username, is_admin, created_at")
      .ilike("username", username.trim())
      .maybeSingle();
    if (!cli) throw new NotFoundException("Client introuvable.");
    const client = cli as { id: string; name: string | null; username: string | null; is_admin: boolean; created_at: string };

    const { data: acc } = await c
      .from("device_access")
      .select("role, status, devices!inner(imei, name)")
      .eq("user_id", client.id);
    const devices = ((acc ?? []) as unknown as { role: string; status: string; devices: { imei: string; name: string | null } }[]).map(
      (a) => ({ imei: a.devices.imei, name: a.devices.name, role: a.role, status: a.status }),
    );

    return { ...client, devices };
  }

  // ─── ENDPOINT 6 — PATCH /admin/clients/:username/promote ─────────────────────
  async promote(username: string, isAdmin: boolean, callerId: string): Promise<PromoteResult> {
    const target = await this.resolveUser(username);
    if (!target) throw new NotFoundException("Client introuvable.");
    if (target.id === callerId) {
      throw new BadRequestException("Vous ne pouvez pas modifier votre propre statut admin.");
    }
    const { data, error } = await this.client()
      .from("clients")
      .update({ is_admin: isAdmin })
      .eq("id", target.id)
      .select("id, username, is_admin")
      .single();
    if (error) throw new ServiceUnavailableException(error.message);
    return data as PromoteResult;
  }

  // ─── ENDPOINT 7 — DELETE /admin/devices/purge-test ───────────────────────────
  async purgeTest(confirm: boolean): Promise<PurgeResult> {
    const c = this.client();
    const { data, error } = await c.from("devices").select("id, imei, name, traccar_id");
    if (error) throw new ServiceUnavailableException(error.message);

    const candidates: PurgeCandidate[] = ((data ?? []) as { id: string; imei: string; name: string | null; traccar_id: number | null }[])
      .filter((d) => isTestImei(d.imei))
      .map((d) => ({ id: d.id, imei: d.imei, name: d.name, traccarId: d.traccar_id }));

    if (!confirm) return { dryRun: true, count: candidates.length, devices: candidates };

    for (const d of candidates) {
      if (d.traccarId != null) {
        try {
          await this.traccar.deleteDevice(d.traccarId);
        } catch {
          /* déjà absent côté Traccar : on nettoie quand même la base app */
        }
      }
      await this.devices.deleteByImei(d.imei);
    }
    return { dryRun: false, count: candidates.length, devices: candidates };
  }
}
