import { API_URL } from "../config/env";
import { authHeader } from "./authHeader";
import i18n from "../i18n";
import { classifyNetworkRaw, classifyStatus, logError, userMessage, type ErrorKind } from "./errorMessages";
import type { VehicleVM } from "../types/vehicle";

/**
 * Erreur normalisée de l'API façade.
 *
 * `userMessage` est TOUJOURS un message français sûr, affichable tel quel.
 * `message` (hérité d'`Error`) porte le détail technique pour les logs — jamais l'UI.
 * Les écrans doivent afficher `toUserMessage(err)` (qui lit `userMessage`), pas `err.message`.
 */
export class ApiError extends Error {
  readonly userMessage: string;
  readonly kind: ErrorKind;
  readonly status?: number;

  constructor(userMessage: string, opts: { status?: number; kind?: ErrorKind; technical?: string } = {}) {
    super(opts.technical ?? userMessage); // .message = technique (logs)
    this.name = "ApiError";
    this.userMessage = userMessage;
    this.status = opts.status;
    this.kind = opts.kind ?? classifyStatus(opts.status);
  }
}

/**
 * Rejet BRUT de `fetch` (connectivité) → `ApiError` avec message utilisateur sûr.
 * Le détail technique (exception Java, « Network request failed »…) est journalisé
 * puis jeté ; il ne remonte jamais en UI.
 */
export function networkError(e: unknown): ApiError {
  const kind = classifyNetworkRaw(e);
  logError("api.network", e);
  const technical = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return new ApiError(userMessage(kind), { kind, technical });
}

/**
 * Réponse HTTP non-2xx → `ApiError`. `override` permet un message métier déjà sûr
 * (ex. « IMEI ou mot de passe incorrect ») ; sinon message standard selon le code.
 */
export function statusError(status: number, override?: string): ApiError {
  const kind = classifyStatus(status);
  return new ApiError(override ?? userMessage(kind), { status, kind, technical: `HTTP ${status}` });
}

/** Corps de réponse d'erreur de la façade (message métier éventuel). */
type ErrorBody = { code?: string; message?: string } | null;

export interface RequestOptions {
  method?: string;
  /** Corps JSON (sérialisé automatiquement). */
  body?: unknown;
  signal?: AbortSignal;
  /** `false` : requête publique, pas d'en-tête Authorization (login). */
  auth?: boolean;
  /**
   * Message métier SÛR (déjà traduit) pour un code HTTP donné — ex. 401 au login,
   * 403 à l'ajout de dispositif. Retourner `undefined` = message standard du code.
   */
  mapError?: (status: number, body: ErrorBody) => string | undefined;
}

/**
 * §4.1 — CLIENT RÉSEAU UNIQUE de l'app. Toute requête HTTP passe par ici :
 * l'exception brute de `fetch` (`NoRouteToHostException`, « Network request failed »…)
 * comme la réponse HTTP non-2xx sont converties en `ApiError` typée, dont seul
 * `userMessage` (traduit) atteint l'UI. Aucun écran ne voit jamais l'erreur brute.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, auth = true, mapError } = opts;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(auth ? await authHeader() : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw networkError(e);
  }

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ErrorBody;
    throw statusError(res.status, mapError?.(res.status, errBody));
  }

  // 204 / corps vide (DELETE, PATCH sans retour) → `undefined` typé par l'appelant.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** GET /vehicles — positions réelles (view-model §6.1). */
export function fetchVehicles(signal?: AbortSignal): Promise<VehicleVM[]> {
  return request<VehicleVM[]>("/vehicles", { signal });
}

/**
 * POST /auth/imei-login — login par IMEI routé via l'API (rate-limité par IMEI, §3.5).
 * Retourne les tokens de session que l'app pose via `supabase.auth.setSession`.
 * Erreur générique unique ; 429 si trop de tentatives.
 */
export function imeiLogin(imei: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
  return request<{ accessToken: string; refreshToken: string }>("/auth/imei-login", {
    method: "POST",
    auth: false,
    body: { imei, password },
    mapError: (status, body) =>
      status === 429 ? (body?.message ?? i18n.t("errors.rateLimit")) : i18n.t("errors.loginInvalid"),
  });
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

/**
 * POST /vehicles/access — ajoute un ACCÈS coexistant à un device EXISTANT via
 * IMEI + mot de passe du dispositif (§3). Plusieurs comptes peuvent coexister.
 * Erreur générique UNIQUE (anti-énumération) : IMEI inconnu et mauvais mot de passe
 * renvoient le même message ; 429 si trop de tentatives (rate-limit par IMEI).
 */
export function addVehicleAccess(imei: string, devicePassword: string): Promise<VehicleVM> {
  return request<VehicleVM>("/vehicles/access", {
    method: "POST",
    body: { imei, devicePassword },
    mapError: (status, body) => {
      if (status === 429) return body?.message ?? i18n.t("errors.rateLimit");
      // Anti-énumération : IMEI inconnu ET mauvais mot de passe → MÊME message générique.
      if (status === 403 || status === 400) return i18n.t("errors.imeiOrPwdInvalid");
      return undefined;
    },
  });
}

/** PATCH /vehicles/:id/device-password — change le mot de passe DU DISPOSITIF (propriétaire). */
export async function changeDevicePassword(id: number, newPassword: string): Promise<void> {
  await request<void>(`/vehicles/${id}/device-password`, {
    method: "PATCH",
    body: { newPassword },
    mapError: (status) => (status === 403 ? i18n.t("errors.ownerOnlyPwd") : undefined),
  });
}

/** DELETE /vehicles/:id — retire un véhicule (propriétaire + mot de passe compte). */
export async function deleteVehicle(id: number, password: string): Promise<void> {
  await request<void>(`/vehicles/${id}`, {
    method: "DELETE",
    body: { password },
    mapError: (status) => {
      if (status === 401) return i18n.t("errors.wrongPassword");
      if (status === 403) return i18n.t("errors.ownerOnlyDelete");
      return undefined;
    },
  });
}

/** PATCH /vehicles/:id — persiste les champs métier (base app). */
export function patchVehicle(id: number, patch: VehiclePatch): Promise<VehicleVM> {
  return request<VehicleVM>(`/vehicles/${id}`, { method: "PATCH", body: patch });
}
