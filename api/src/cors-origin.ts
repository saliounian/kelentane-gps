/**
 * Logique CORS partagée entre l'API REST (main.ts) et le gateway Socket.io.
 *
 * CORS_ORIGINS (liste séparée par virgules) restreint les origines web si définie ;
 * les requêtes SANS en-tête Origin (apps mobiles natives) restent toujours admises.
 * Absente → ouvert (comportement historique).
 *
 * Origine non autorisée → `callback(null, false)` : pas d'erreur (donc pas de
 * HTTP 500 côté Express), simplement aucun en-tête CORS — c'est le navigateur
 * qui bloque. Lue à chaque appel (pas à l'import) : le décorateur du gateway
 * s'évalue avant que ConfigModule ne charge `.env`.
 */
export function parseCorsOrigins(raw = process.env.CORS_ORIGINS): string[] {
  return (raw ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  const allowed = parseCorsOrigins();
  callback(null, allowed.length === 0 || !origin || allowed.includes(origin));
}
