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

/**
 * Résultat de la lecture clients.must_change_password — FAIL-CLOSED :
 * - "loading"  lecture en cours (ou pas encore démarrée après connexion).
 * - "required" valeur explicite `true` → mot de passe par défaut encore actif.
 * - "ok"       valeur explicite `false` → rien à faire, entrée autorisée.
 * - "unknown"  INDÉTERMINABLE (erreur, ligne absente, valeur ni true ni false,
 *              timeout, exception) → ne doit JAMAIS laisser entrer dans l'app.
 */
export type MustChangePasswordStatus = "loading" | "required" | "ok" | "unknown";

const MUST_CHANGE_PWD_TIMEOUT_MS = 10_000;

type SignUpInput = { fullName: string; phone: string; username: string; password: string };

type AuthCtx = {
  status: AuthStatus;
  session: Session | null;
  mustChangePasswordStatus: MustChangePasswordStatus;
  /** Relance la lecture (bouton "Réessayer" de l'écran "unknown"). */
  retryMustChangePasswordCheck: () => Promise<void>;
  /**
   * Relit le flag après un changement de mot de passe réussi (supabase.auth.updateUser).
   * `ok: false` = lecture indéterminable (timeout/erreur/pas de session) → NE PAS
   * laisser entrer. `ok: true, required: true` = flag recalculé toujours actif
   * (ex. nouveau mdp qui vaut encore "123456") → NE PAS laisser entrer non plus.
   * Seul `{ ok: true, required: false }` autorise l'entrée dans l'app.
   */
  recheckMustChangePassword: () => Promise<{ ok: boolean; required: boolean }>;
  signIn: (identifier: string, password: string, remember?: boolean) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  checkUsername: (username: string) => Promise<boolean>; // true = disponible
};

const Ctx = createContext<AuthCtx | null>(null);

/**
 * Lecture brute de clients.must_change_password. Ne renvoie `true`/`false` que
 * pour une valeur EXPLICITE en base ; tout le reste (ligne absente, colonne
 * null/undefined, erreur SQL, exception, timeout) → `null` ("indéterminable").
 * Timeout 10 s via Promise.race : ne reste JAMAIS en attente indéfinie. Ne
 * lève JAMAIS (try/catch) : le caller n'a pas besoin de .catch pour ÇA, mais
 * on en ajoute quand même là où cette fonction est appelée (défense en
 * profondeur, cf. useEffect ci-dessous).
 */
async function fetchMustChangePasswordRow(uid: string): Promise<boolean | null> {
  try {
    const query = supabase.from("clients").select("must_change_password").eq("id", uid).maybeSingle();
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("must_change_password: timeout 10s")), MUST_CHANGE_PWD_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([query, timeout]);
    if (error) {
      logError("auth.fetchMustChangePassword", error);
      return null;
    }
    const v = (data as { must_change_password: boolean | null } | null)?.must_change_password;
    if (v === true) return true;
    if (v === false) return false;
    return null; // ligne absente, ou valeur ni true ni false
  } catch (e) {
    logError("auth.fetchMustChangePassword", e);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [mustChangePasswordStatus, setMustChangePasswordStatus] = useState<MustChangePasswordStatus>("loading");
  // Le login IMEI pilote lui-même le résultat (y compris la relecture obligatoire
  // du cas "false", cf. signIn) : on empêche onAuthStateChange("SIGNED_IN") de
  // lancer sa propre lecture concurrente pour ce même login.
  const skipNextSignedInFetch = useRef(false);

  const refetchMustChangePassword = async (uid: string): Promise<MustChangePasswordStatus> => {
    setMustChangePasswordStatus("loading");
    const v = await fetchMustChangePasswordRow(uid);
    const next: MustChangePasswordStatus = v === true ? "required" : v === false ? "ok" : "unknown";
    setMustChangePasswordStatus(next);
    return next;
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
      })
      .catch((e) => {
        // Échec du boot (storage/session) : jamais de "checking" indéfini → repli
        // sûr sur "out" (écran de connexion, l'utilisateur peut se reconnecter).
        logError("auth.boot", e);
        setStatus("out");
      });

    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      setStatus(s ? "in" : "out");
      if (!s) {
        setMustChangePasswordStatus("loading"); // repart propre pour la prochaine connexion
        return;
      }
      if (e === "SIGNED_IN") {
        if (skipNextSignedInFetch.current) {
          skipNextSignedInFetch.current = false;
        } else {
          refetchMustChangePassword(s.user.id).catch((err) => {
            logError("auth.onAuthStateChange.refetch", err);
            setMustChangePasswordStatus("unknown");
          });
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const retryMustChangePasswordCheck = async (): Promise<void> => {
    const uid = session?.user?.id;
    if (!uid) {
      setMustChangePasswordStatus("unknown");
      return;
    }
    await refetchMustChangePassword(uid);
  };

  const recheckMustChangePassword = async (): Promise<{ ok: boolean; required: boolean }> => {
    const uid = session?.user?.id;
    if (!uid) return { ok: false, required: true };
    const result = await refetchMustChangePassword(uid);
    if (result === "unknown") return { ok: false, required: true };
    return { ok: true, required: result === "required" };
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
      const { data: sessionData, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) {
        skipNextSignedInFetch.current = false;
        throw authError(error);
      }
      const uid = sessionData.session?.user.id;
      if (mcp === true) {
        // L'API dit explicitement "oui" → on bloque directement, pas de relecture requise.
        setMustChangePasswordStatus("required");
      } else if (mcp === false && uid) {
        // Jamais se fier seul à "false" venant de l'API → relecture base obligatoire.
        await refetchMustChangePassword(uid);
      } else {
        // mcp === null (indéterminable côté serveur) ou uid introuvable → fail-closed.
        setMustChangePasswordStatus("unknown");
      }
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
    () => ({
      status,
      session,
      mustChangePasswordStatus,
      retryMustChangePasswordCheck,
      recheckMustChangePassword,
      signIn,
      signUp,
      signOut,
      checkUsername,
    }),
    [status, session, mustChangePasswordStatus],
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
