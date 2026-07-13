import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Storage de session Supabase piloté par « Se souvenir de moi » (§1).
 *
 * - Remember ON  → la session (dont le refresh token) est persistée dans le
 *   trousseau sécurisé (expo-secure-store). Reconnexion auto au démarrage.
 * - Remember OFF → session éphémère en mémoire uniquement : perdue au prochain
 *   démarrage à froid (comportement de session courte).
 *
 * On ne stocke JAMAIS le mot de passe — uniquement les tokens gérés par Supabase.
 * SecureStore limite la taille par clé (~2 Ko) → on découpe en fragments.
 */

const REMEMBER_KEY = "auth.remember";
const IDENTIFIER_KEY = "auth.lastIdentifier";
const CHUNK = 1800;

const mem = new Map<string, string>();
let remember = true; // réévalué au boot (loadRememberFlag) puis à chaque login

/** SecureStore n'autorise que [A-Za-z0-9._-] en clé → on encode. */
const enc = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");

async function secureSet(key: string, value: string): Promise<void> {
  const n = Math.max(1, Math.ceil(value.length / CHUNK));
  await SecureStore.setItemAsync(`${key}.n`, String(n));
  for (let i = 0; i < n; i++) {
    await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
}
async function secureGet(key: string): Promise<string | null> {
  const nStr = await SecureStore.getItemAsync(`${key}.n`);
  if (!nStr) return null;
  const n = Number(nStr);
  let out = "";
  for (let i = 0; i < n; i++) {
    const c = await SecureStore.getItemAsync(`${key}.${i}`);
    if (c == null) return null;
    out += c;
  }
  return out;
}
async function secureDel(key: string): Promise<void> {
  const nStr = await SecureStore.getItemAsync(`${key}.n`);
  const n = nStr ? Number(nStr) : 0;
  await SecureStore.deleteItemAsync(`${key}.n`);
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
}

/** Adapter branché sur `createClient(..., { auth: { storage } })`. */
export const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const k = enc(key);
    const secure = await secureGet(k);
    if (secure != null) return secure;
    return mem.get(key) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const k = enc(key);
    if (remember) {
      mem.delete(key);
      await secureSet(k, value);
    } else {
      // éphémère : mémoire seule, et on purge tout résidu persistant
      mem.set(key, value);
      await secureDel(k);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    mem.delete(key);
    await secureDel(enc(key));
  },
};

/** Charge le flag « remember » au démarrage (défaut true = comportement historique). */
export async function loadRememberFlag(): Promise<boolean> {
  const v = await AsyncStorage.getItem(REMEMBER_KEY);
  remember = v !== "0";
  return remember;
}

/** Fixe le flag « remember » (appelé avant le login). */
export async function setRemember(on: boolean): Promise<void> {
  remember = on;
  await AsyncStorage.setItem(REMEMBER_KEY, on ? "1" : "0");
}

/** Pré-remplissage : dernier identifiant utilisé (jamais le mot de passe). */
export async function rememberedIdentifier(): Promise<{ identifier: string; remember: boolean }> {
  const [id, rem] = await Promise.all([AsyncStorage.getItem(IDENTIFIER_KEY), AsyncStorage.getItem(REMEMBER_KEY)]);
  return { identifier: id ?? "", remember: rem !== "0" && rem !== null };
}
export async function saveIdentifier(identifier: string): Promise<void> {
  await AsyncStorage.setItem(IDENTIFIER_KEY, identifier.trim());
}
