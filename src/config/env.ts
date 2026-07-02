/**
 * Config runtime du mobile.
 *
 * Sécurité : ce fichier ne contient QUE des valeurs publiques par conception —
 * l'URL de l'API façade et la clé publishable Supabase (protégée par RLS).
 * Aucune clé Traccar, aucun service_role, aucun secret ici : le mobile ne parle
 * qu'à l'API façade + à Supabase Auth (handoff §12, §55).
 */

/** Base de l'API façade (à surcharger par plateforme à l'étape 3). */
export const API_URL = "http://localhost:3000";

/** Supabase (base app) — Auth + lectures RLS depuis le mobile. */
export const SUPABASE_URL = "https://bgkbkjbjahgmfxcsrqmk.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_OK6XH0PUlBea25Qct6RBRw_54eFe8vN";
