import { API_URL } from "../config/env";
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
    res = await fetch(`${API_URL}${path}`, { signal, headers: { Accept: "application/json" } });
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
