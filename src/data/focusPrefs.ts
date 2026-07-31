import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persistance du FOCUS carte (§3 MapScreen).
 *
 * - `lastConsulted` : dernier véhicule sélectionné (popup/tracé/caméra). Réécrit à
 *   chaque `selectVehicle`, sert de repli (b) au montage.
 * - `lastEnrolled`  : dernier device ajouté SUR CET APPAREIL. Sert de proxy local à
 *   la priorité (a) « dernier device ajouté » tant que l'API façade n'expose pas
 *   `createdAt` sur le view-model (cf. VehicleVM.createdAt, optionnel).
 */
const LAST_CONSULTED_KEY = "map.lastVehicle";
const LAST_ENROLLED_KEY = "map.lastEnrolled";

function readId(key: string): Promise<number | null> {
  return AsyncStorage.getItem(key).then((v) => {
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
}

export const getLastConsulted = (): Promise<number | null> => readId(LAST_CONSULTED_KEY);
export const setLastConsulted = (id: number): Promise<void> =>
  AsyncStorage.setItem(LAST_CONSULTED_KEY, String(id));

export const getLastEnrolled = (): Promise<number | null> => readId(LAST_ENROLLED_KEY);
export const setLastEnrolled = (id: number): Promise<void> =>
  AsyncStorage.setItem(LAST_ENROLLED_KEY, String(id));
