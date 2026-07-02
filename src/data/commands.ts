import { API_URL } from "../config/env";
import { ApiError } from "./api";

export type CommandType = "engineStop" | "engineResume" | "gpsReboot";
export type CommandState = "success" | "offline" | "error";

/** POST /vehicles/:id/commands → { ackId, state }. Lève ApiError (401 = mdp). */
export async function sendCommand(
  vehicleId: number,
  type: CommandType,
  password?: string,
): Promise<{ ackId: string; state: CommandState }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/vehicles/${vehicleId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ type, password }),
    });
  } catch (e) {
    throw new ApiError((e as Error).message || "Réseau indisponible");
  }
  if (res.status === 401) throw new ApiError("Mot de passe incorrect", 401);
  if (!res.ok) throw new ApiError(`Erreur ${res.status}`, res.status);
  return (await res.json()) as { ackId: string; state: CommandState };
}
