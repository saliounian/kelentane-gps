import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, usernameToEmail } from "../data/supabase";
import { imeiLogin } from "../data/api";
import { loadRememberFlag, saveIdentifier, setRemember } from "../data/authStorage";
import { API_URL } from "../config/env";

export type AuthStatus = "checking" | "out" | "in";

type SignUpInput = { fullName: string; phone: string; username: string; password: string };

type AuthCtx = {
  status: AuthStatus;
  session: Session | null;
  signIn: (identifier: string, password: string, remember?: boolean) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  checkUsername: (username: string) => Promise<boolean>; // true = disponible
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // §1 : charger le flag « remember » AVANT de restaurer la session (les écritures
    // de tokens rafraîchis au boot doivent viser le bon storage).
    loadRememberFlag()
      .then(() => supabase.auth.getSession())
      .then(({ data }) => {
        setSession(data.session);
        setStatus(data.session ? "in" : "out");
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setStatus(s ? "in" : "out");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (identifier: string, password: string, remember = true) => {
    const id = identifier.trim();
    // §1 : fixer le mode de persistance AVANT le login, et mémoriser l'identifiant
    // (jamais le mot de passe) pour le pré-remplissage ultérieur.
    await setRemember(remember);
    await saveIdentifier(id);
    // §2/§3.5 : un identifiant purement numérique = IMEI → login routé par l'API
    // (rate-limité par IMEI). Sinon login classique username/email direct Supabase.
    if (/^\d{10,17}$/.test(id)) {
      const { accessToken, refreshToken } = await imeiLogin(id, password);
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw new Error("Identifiant ou mot de passe incorrect.");
      return;
    }
    const email = usernameToEmail(id);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Identifiant ou mot de passe incorrect.");
  };

  const checkUsername = async (username: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/auth/username-available?u=${encodeURIComponent(username.trim())}`);
      if (!res.ok) return true; // ne bloque pas si l'API est indispo (l'unicité email tranche à l'inscription)
      const j = (await res.json()) as { available: boolean };
      return j.available;
    } catch {
      return true;
    }
  };

  const signUp = async ({ fullName, phone, username, password }: SignUpInput) => {
    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      // email synthétique dupliqué = username déjà pris (garantie dure)
      throw new Error(/registered|exists|already/i.test(error.message) ? "Ce nom d'utilisateur est déjà pris." : error.message);
    }
    const userId = data.user?.id;
    if (userId) {
      // upsert : une ligne clients minimale peut déjà exister (trigger handle_new_user).
      // On l'enrichit avec nom/téléphone/identifiant sans échouer l'inscription.
      const { error: cErr } = await supabase
        .from("clients")
        .upsert({ id: userId, name: fullName, phone, username }, { onConflict: "id" });
      if (cErr) console.warn("clients upsert:", cErr.message);
    }
    // Accès immédiat : si pas de session (confirmation email activée), on tente la connexion.
    if (!data.session) {
      await supabase.auth.signInWithPassword({ email, password });
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo<AuthCtx>(
    () => ({ status, session, signIn, signUp, signOut, checkUsername }),
    [status, session],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return v;
}

/** Réplique suggestUsername de la maquette : prénom + 5 premiers chiffres du tél. */
export function suggestUsername(fullName: string, phone: string): string {
  const first = (fullName || "").trim().split(/\s+/)[0] || "";
  const digits = (phone || "").replace(/\D/g, "");
  return `${first}${digits.slice(0, 5)}`;
}
