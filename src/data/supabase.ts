import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config/env";
import { authStorage } from "./authStorage";

/**
 * Client Supabase du mobile — clé PUBLISHABLE uniquement (protégée par RLS).
 * Session persistée via un storage piloté par « Se souvenir de moi » (§1) :
 * trousseau sécurisé si activé, mémoire éphémère sinon. Aucun secret ici.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Identité Supabase = email synthétique dérivé du username (décision étape 9).
 * IMPORTANT : le domaine doit avoir des enregistrements MX — GoTrue rejette à
 * l'inscription publique les domaines sans MX (« Email address is invalid »).
 * `kelentane.com` en a ; `kelentane.app` non → on utilise kelentane.com.
 * Aucun email n'est envoyé (Confirm email désactivé) : ce sont des identités,
 * pas des boîtes réelles.
 */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@kelentane.com`;
}
