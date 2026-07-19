/** View-models des réponses admin. */

export interface AdminDevice {
  id: string;
  imei: string;
  name: string | null;
  traccarId: number | null;
  activeCount: number;
  revalidateCount: number;
  createdAt: string;
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
