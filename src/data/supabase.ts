import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config/env";

/**
 * Client Supabase du mobile — clé PUBLISHABLE uniquement (protégée par RLS).
 * Session persistée via AsyncStorage. Aucun secret ici.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Identité Supabase = email synthétique dérivé du username (décision étape 9). */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@kelentane.app`;
}
