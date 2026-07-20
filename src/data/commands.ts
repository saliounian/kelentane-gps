import i18n from "../i18n";
import { request } from "./api";

export type CommandType = "engineStop" | "engineResume" | "gpsReboot";
export type CommandState = "success" | "offline" | "error";

/** POST /vehicles/:id/commands (auth) → { ackId, state }. 401 = non authentifié / mdp. */
export function sendCommand(
  vehicleId: number,
  type: CommandType,
  password?: string,
): Promise<{ ackId: string; state: CommandState }> {
  return request<{ ackId: string; state: CommandState }>(`/vehicles/${vehicleId}/commands`, {
    method: "POST",
    body: { type, password },
    mapError: (status) => (status === 401 ? i18n.t("errors.wrongPassword") : undefined),
  });
}
