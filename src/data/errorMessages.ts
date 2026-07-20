/**
 * Couche centrale de traduction des erreurs (réseau / API / auth).
 *
 * OBJECTIF : aucun message technique, stacktrace, nom d'exception (Java/Kotlin,
 * `NoRouteToHostException`, `Network request failed`…) ni terme de programmation
 * ne doit JAMAIS atteindre l'utilisateur final. Tout est traduit dans la langue
 * choisie par l'utilisateur (§4) via i18n (`errors.*` — fr/en/ar, wo → fallback fr).
 *
 * Le détail technique brut est conservé UNIQUEMENT pour les logs de debug
 * (`logError`) — jamais affiché en UI.
 *
 * Le texte est résolu à la volée (`i18n.t`) : un message construit ici est un
 * message SÛR, affichable tel quel par `ErrorState` / le traducteur central.
 */

import i18n from "../i18n";

export type ErrorKind =
  | "network" // pas de connexion / hôte injoignable
  | "timeout" // requête trop lente / serveur ne répond pas
  | "server" // 5xx — service temporairement indisponible
  | "unauthorized" // 401 en session — session expirée
  | "forbidden" // 403 — droits insuffisants
  | "notFound" // 404
  | "rateLimit" // 429 — trop de tentatives
  | "client" // 4xx générique
  | "unknown"; // filet de sécurité (jamais l'erreur brute)

/** Message utilisateur (langue courante), sans aucun terme technique. */
export function userMessage(kind: ErrorKind): string {
  return i18n.t(`errors.${kind}`);
}

/** Classe un code HTTP en catégorie utilisateur. */
export function classifyStatus(status?: number): ErrorKind {
  if (status == null) return "unknown";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 408) return "timeout";
  if (status === 429) return "rateLimit";
  if (status >= 500) return "server";
  if (status >= 400) return "client";
  return "unknown";
}

/**
 * Classe une erreur BRUTE de fetch (rejet de la promesse `fetch`) en `network`
 * ou `timeout`. Couvre les libellés natifs iOS/Android (dont les exceptions Java
 * `NoRouteToHostException`, `UnknownHostException`, `ConnectException`…).
 * Par défaut, tout rejet réseau non identifié est traité comme `network`.
 */
export function classifyNetworkRaw(e: unknown): ErrorKind {
  const anyErr = (e ?? {}) as { name?: string; message?: string };
  const name = anyErr.name ?? "";
  const msg = (anyErr.message ?? String(e ?? "")).toLowerCase();
  if (name === "AbortError" || /timed?\s?out|timeout|abort|délai|deadline/.test(msg)) return "timeout";
  return "network";
}

/** Vrai si l'erreur relève d'un problème de connectivité (réseau ou délai). */
export function isNetworkError(e: unknown): boolean {
  if (e == null) return false;
  const anyErr = e as { kind?: ErrorKind; name?: string; message?: string; status?: number };
  if (anyErr.kind === "network" || anyErr.kind === "timeout") return true;
  // erreurs supabase-js réseau : AuthRetryableFetchError / AbortError / TypeError « Network request failed »
  const name = anyErr.name ?? "";
  const msg = (anyErr.message ?? "").toLowerCase();
  if (name === "AbortError" || /retryable|networkerror/i.test(name)) return true;
  // sans code HTTP (rejet brut de fetch), un libellé de connectivité/délai = réseau
  if (anyErr.status === 0 || anyErr.status === undefined) {
    if (/network request failed|no route to host|host unreachable|unable to resolve host|unknownhost|connectexception|failed to connect|networkerror|load failed|timed?\s?out|timeout|abort|socket|econn|enotfound/i.test(msg)) {
      return true;
    }
  }
  return false;
}

/**
 * Traducteur central utilisé par l'UI. Prend N'IMPORTE quelle valeur levée et
 * renvoie un message sûr dans la langue courante. Ne renvoie JAMAIS l'erreur brute.
 *
 * Ordre de résolution :
 *  1. `ApiError` (ou objet portant un `userMessage` déjà sûr) → tel quel.
 *  2. code HTTP `status` → catégorie.
 *  3. erreur réseau/supabase reconnue → réseau/délai.
 *  4. sinon → message générique de secours.
 */
export function toUserMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const anyErr = error as {
      userMessage?: unknown;
      status?: unknown;
      kind?: ErrorKind;
      name?: string;
      message?: string;
    };
    if (typeof anyErr.userMessage === "string" && anyErr.userMessage.trim()) {
      return anyErr.userMessage;
    }
    if (anyErr.kind) return userMessage(anyErr.kind);
    if (typeof anyErr.status === "number" && anyErr.status > 0) {
      return userMessage(classifyStatus(anyErr.status));
    }
    if (isNetworkError(error)) return userMessage(classifyNetworkRaw(error));
  }
  return userMessage("unknown");
}

/**
 * Journalise l'erreur COMPLÈTE (technique) pour le debug interne — jamais affichée
 * à l'utilisateur. Point d'accroche unique pour brancher Sentry/Crashlytics plus tard.
 */
export function logError(scope: string, error: unknown): void {
  // Détail brut conservé volontairement (exception, stacktrace, code HTTP…).
  // eslint-disable-next-line no-console
  console.error(`[${scope}]`, error);
}
