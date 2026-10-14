import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, usernameToEmail } from "../data/supabase";
import i18n from "../i18n";
import { ApiError, imeiLogin, request } from "../data/api";
import { isNetworkError, logError, userMessage } from "../data/errorMessages";
import { loadRememberFlag, saveIdentifier, setRemember } from "../data/authStorage";

/**
 * Traduit une erreur d'authentification supabase en `ApiError` sûre :
 * problème réseau → message de connexion ; sinon → identifiants incorrects.
 * Le détail technique (message supabase) est journalisé, jamais affiché.
 */
function authError(raw: unknown): ApiError {
  logError("auth", raw);
  if (isNetworkError(raw)) return new ApiError(userMessage("network"), { kind: "network" });
  return new ApiError(i18n.t("errors.loginInvalid"), { status: 401 });
}

export type AuthStatus = "checking" | "out" | "in";

type SignUpInput = { fullName: string; phone: string; username: string; password: string };

type AuthCtx = {
  status: AuthStatus;
  session: Session | null;
  /** null = pas encore déterminé (session présente, lecture en cours). */
  mustChangePassword: boolean | null;
  /** Relit clients.must_change_password en base et met à jour le contexte. */
  recheckMustChangePassword: () => Promise<boolean>;
  signIn: (identifier: string, password: string, remember?: boolean) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  checkUsername: (username: string) => Promise<boolean>; // true = disponible
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);
  // Le login IMEI connaît déjà mustChangePassword (réponse API) : on pose setSession()
  // nous-mêmes juste après, ce qui déclenche aussi "SIGNED_IN" côté onAuthStateChange —
  // ce flag évite une 2e lecture (redondante) de clients.must_change_password.
  const skipNextSignedInFetch = useRef(false);

  const refetchMustChangePassword = async (uid: string): Promise<boolean> => {
    const { data } = await supabase.from("clients").select("must_change_password").eq("id", uid).maybeSingle();
    const v = (data as { must_change_password: boolean } | null)?.must_change_password === true;
    setMustChangePassword(v);
    return v;
  };

  useEffect(() => {
    // §1 : charger le flag « remember » AVANT de restaurer la session (les écritures
    // de tokens rafraîchis au boot doivent viser le bon storage).
    loadRememberFlag()
      .then(() => supabase.auth.getSession())
      .then(async ({ data }) => {
        setSession(data.session);
        setStatus(data.session ? "in" : "out");
        if (data.session) await refetchMustChangePassword(data.session.user.id);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      setStatus(s ? "in" : "out");
      if (!s) {
        setMustChangePassword(null);
        return;
      }
      if (e === "SIGNED_IN") {
        if (skipNextSignedInFetch.current) {
          skipNextSignedInFetch.current = false;
        } else {
          void refetchMustChangePassword(s.user.id);
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const recheckMustChangePassword = async (): Promise<boolean> => {
    const uid = session?.user?.id;
    if (!uid) return false;
    return refetchMustChangePassword(uid);
  };

  const signIn = async (identifier: string, password: string, remember = true) => {
    const id = identifier.trim();
    // §1 : fixer le mode de persistance AVANT le login, et mémoriser l'identifiant
    // (jamais le mot de passe) pour le pré-remplissage ultérieur.
    await setRemember(remember);
    await saveIdentifier(id);
    // §2/§3.5 : un identifiant purement numérique = IMEI → login routé par l'API
    // (rate-limité par IMEI). Sinon login classique username/email direct Supabase.
    if (/^\d{10,17}$/.test(id)) {
      const { accessToken, refreshToken, mustChangePassword: mcp } = await imeiLogin(id, password);
      skipNextSignedInFetch.current = true;
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) {
        skipNextSignedInFetch.current = false;
        throw authError(error);
      }
      setMustChangePassword(mcp);
      return;
    }
    const email = usernameToEmail(id);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw authError(error);
    // onAuthStateChange ("SIGNED_IN") lit clients.must_change_password pour ce flux.
  };

  const checkUsername = async (username: string): Promise<boolean> => {
    // §4.1 : passe par le client réseau unique. Indisponibilité API = on ne bloque
    // pas la saisie (l'unicité de l'email synthétique tranche à l'inscription).
    try {
      const j = await request<{ available: boolean }>(`/auth/username-available?u=${encodeURIComponent(username.trim())}`, { auth: false });
      return j.available;
    } catch {
      return true;
    }
  };

  const signUp = async ({ fullName, phone, username, password }: SignUpInput) => {
    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      logError("auth.signUp", error);
      // email synthétique dupliqué = username déjà pris (garantie dure)
      if (/registered|exists|already/i.test(error.message)) { // check-error-leaks-allow : classement, jamais affiché
        throw new ApiError(i18n.t("auth.usernameTaken"), { status: 409 });
      }
      if (isNetworkError(error)) throw new ApiError(userMessage("network"), { kind: "network" });
      // jamais le message technique supabase brut → filet générique
      throw new ApiError(userMessage("unknown"), { kind: "unknown" });
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
    () => ({ status, session, mustChangePassword, recheckMustChangePassword, signIn, signUp, signOut, checkUsername }),
    [status, session, mustChangePassword],
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
