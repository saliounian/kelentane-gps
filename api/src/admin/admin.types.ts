/** View-models des réponses admin. */

export type CommercialStatus = "stock" | "sold";

export interface AdminDevice {
  id: string;
  imei: string;
  name: string | null;
  traccarId: number | null;
  activeCount: number;
  revalidateCount: number;
  createdAt: string;
  // Dimension commerciale (web/admin only) — distincte du online/offline Traccar.
  commercialStatus: CommercialStatus;
  firstConnectedAt: string | null;
}

/** Agrégat inventaire (§stats). N.B. online/offline Traccar N'EST PAS ici. */
export interface DeviceStats {
  stock: number;
  sold: number;
  total: number;
}

/** Données de la fiche device (PDF + QR générés côté web). */
export interface DeviceCard {
  imei: string;
  name: string | null;
  defaultPassword: string;
  commercial_status: CommercialStatus;
}

export interface DeviceStatusResult {
  imei: string;
  commercialStatus: CommercialStatus;
  firstConnectedAt: string | null;
}

/** Un compte ayant un accès à un device (GET /admin/devices/:imei/accounts). */
export interface DeviceAccountAccess {
  username: string | null;
  name: string | null;
  role: "consultation" | "action";
  status: "active" | "revalidate";
  is_admin: boolean;
  /** created_at de la ligne device_access = date d'octroi de l'accès. */
  granted_at: string;
}

export type BulkEnrollStatus = "created" | "exists" | "error";
export interface BulkEnrollResult {
  imei: string;
  status: BulkEnrollStatus;
  message?: string;
}

export interface TransferResult {
  transferred: true;
  imei: string;
  from: string;
  to: string;
}

export interface AdminClientDevice {
  imei: string;
  name: string | null;
  role: string;
  status: string;
}
export interface AdminClientView {
  id: string;
  name: string | null;
  username: string | null;
  is_admin: boolean;
  created_at: string;
  devices: AdminClientDevice[];
}

export interface PromoteResult {
  id: string;
  username: string | null;
  is_admin: boolean;
}

export interface PurgeCandidate {
  id: string;
  imei: string;
  name: string | null;
  traccarId: number | null;
}
export interface PurgeResult {
  dryRun: boolean;
  count: number;
  devices: PurgeCandidate[];
}
