import * as Location from "expo-location";

/**
 * Repli géocodage inverse (Google/OS) → nom de lieu COURT, quand l'adresse Traccar
 * (`position.address`) est absente. Priorité : quartier (`district`/`subregion`)
 * → rue/point courte → localité. Ne renvoie JAMAIS de coordonnées brutes.
 *
 * Cache module-level par coordonnée ARRONDIE (~4 décimales) : un même point (lu à
 * chaque frame de lecture du trajet) n'appelle le géocodeur qu'UNE fois.
 */
const cache = new Map<string, string | null>();

export async function reverseGeocodeShort(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  try {
    const res = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const a = res[0];
    // Ordre imposé (§1) : QUARTIER d'abord (`district` = sublocality Android /
    // neighborhood iOS), puis adresse courte (rue ou nom du point), puis localité.
    // `subregion` (≈ département) reste en dernier recours : trop large pour être utile.
    const label = a ? (a.district ?? a.street ?? a.name ?? a.city ?? a.subregion ?? a.region ?? null) : null;
    cache.set(key, label);
    return label;
  } catch {
    return null; // géocodeur indisponible → on laisse le placeholder de chargement
  }
}
