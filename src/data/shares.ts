import i18n from "../i18n";
import { request } from "./api";

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    body,
    // partage inconnu/expiré → message métier, pas le 404 générique
    mapError: (status) => (status === 404 ? i18n.t("errors.shareInvalid") : undefined),
  });

/** Émet un jeton de partage (lecture) pour un véhicule. */
export const createShare = (vehicleId: number) =>
  post<{ token: string; scope: string }>(`/vehicles/${vehicleId}/share`);

/** Réclame un véhicule partagé via son jeton. */
export const claimShare = (token: string) => post<{ ok: true }>(`/shares/claim`, { token });
