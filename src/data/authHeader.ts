import { supabase } from "./supabase";

/** En-tête Authorization Bearer depuis la session Supabase courante (ou vide). */
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
