import { API_URL } from "../config/env";
import { authHeader } from "./authHeader";
import type { VehicleVM } from "../types/vehicle";

/** Erreur normalisée de l'API façade. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { signal, headers: { Accept: "application/json", ...(await authHeader()) } });
  } catch (e) {
    throw new ApiError((e as Error).message || "Réseau indisponible");
  }
  if (!res.ok) {
    throw new ApiError(res.status === 502 ? "Cœur GPS injoignable" : `Erreur ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

/** GET /vehicles — positions réelles (view-model §6.1). */
export function fetchVehicles(signal?: AbortSignal): Promise<VehicleVM[]> {
  return getJson<VehicleVM[]>("/vehicles", signal);
}

/** Champs métier éditables persistés via PATCH /vehicles/:id. */
export interface VehiclePatch {
  name?: string;
  plate?: string;
  type?: string;
  iconKey?: string;
  sim?: string;
  phone?: string;
}

/** Levée quand l'IMEI existe déjà : l'app doit demander le mot de passe du dispositif. */
export class TransferRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferRequiredError";
  }
}

/**
 * POST /vehicles — enrôle un boîtier (IMEI), ou le TRANSFÈRE si déjà rattaché à un
 * autre compte (avec `devicePassword`). Sans mot de passe sur un IMEI existant →
 * `TransferRequiredError` (l'app affiche le champ mot de passe du dispositif).
 */
export async function enrollVehicle(imei: string, name?: string, devicePassword?: string): Promise<VehicleVM> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/vehicles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(await authHeader()) },
      body: JSON.stringify({ imei, name, devicePassword }),
    });
  } catch (e) {
    throw new ApiError((e as Error).message || "Réseau indisponible");
  }
  if (res.ok) return (await res.json()) as VehicleVM;

  const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
  if (res.status === 409 && body?.code === "transfer_required") {
    throw new TransferRequiredError(body.message ?? "Mot de passe du dispositif requis");
  }
  if (res.status === 403 && body?.code === "bad_device_password") {
    throw new ApiError("Mot de passe incorrect pour ce dispositif", 403);
  }
  if (res.status === 409) throw new ApiError("Ce boîtier est déjà enregistré", 409);
  if (res.status === 400) throw new ApiError(body?.message ?? "IMEI invalide", 400);
  throw new ApiError(body?.message ?? `Erreur ${res.status}`, res.status);
}

/** PATCH /vehicles/:id/device-password — change le mot de passe DU DISPOSITIF (propriétaire). */
export async function changeDevicePassword(id: number, newPassword: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/vehicles/${id}/device-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(await authHeader()) },
      body: JSON.stringify({ newPassword }),
    });
  } catch (e) {
    throw new ApiError((e as Error).message || "Réseau indisponible");
  }
  if (res.status === 403) throw new ApiError("Seul le propriétaire peut changer ce mot de passe", 403);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? `Erreur ${res.status}`, res.status);
  }
}

/** DELETE /vehicles/:id — retire un véhicule (propriétaire + mot de passe compte). */
export async function deleteVehicle(id: number, password: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/vehicles/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(await authHeader()) },
      body: JSON.stringify({ password }),
    });
  } catch (e) {
    throw new ApiError((e as Error).message || "Réseau indisponible");
  }
  if (res.status === 401) throw new ApiError("Mot de passe incorrect", 401);
  if (res.status === 403) throw new ApiError("Seul le propriétaire peut supprimer", 403);
  if (!res.ok) throw new ApiError(`Erreur ${res.status}`, res.status);
}

/** PATCH /vehicles/:id — persiste les champs métier (base app). */
export async function patchVehicle(id: number, patch: VehiclePatch): Promise<VehicleVM> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(await authHeader()) },
      body: JSON.stringify(patch),
    });
  } catch (e) {
    throw new ApiError((e as Error).message || "Réseau indisponible");
  }
  if (!res.ok) throw new ApiError(`Erreur ${res.status}`, res.status);
  return (await res.json()) as VehicleVM;
}
