import { API_URL } from "../config/env";
import { ApiError } from "./api";
import { authHeader } from "./authHeader";

async function post<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(await authHeader()) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError((e as Error).message || "Réseau indisponible");
  }
  if (res.status === 401) throw new ApiError("Authentification requise", 401);
  if (!res.ok) throw new ApiError(res.status === 404 ? "Jeton invalide" : `Erreur ${res.status}`, res.status);
  return (await res.json()) as T;
}

/** Émet un jeton de partage (lecture) pour un véhicule. */
export const createShare = (vehicleId: number) =>
  post<{ token: string; scope: string }>(`/vehicles/${vehicleId}/share`);

/** Réclame un véhicule partagé via son jeton. */
export const claimShare = (token: string) => post<{ ok: true }>(`/shares/claim`, { token });
