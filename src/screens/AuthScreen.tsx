import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Check, Hash, KeyRound, Moon, Phone, Sun, UserRound } from "lucide-react-native";
import { ACCENT, ALERT, hexA, LIME_ON, ONLINE } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth, suggestUsername } from "../state/auth";
import { BottomSheet, Field, KMonogram } from "../ui";

/** Écran de vérification de session (authStatus === "checking"). Maquette : SessionSplash. */
export function SessionSplash() {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", gap: 14 }}>
      <KMonogram />
      <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>Vérification de la session…</Text>
    </View>
  );
}

/** Gate racine quand authStatus === "out" : connexion + auto-inscription. */
export function AuthScreen() {
  const { t, dark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<"login" | "register">("login");
  const [forgot, setForgot] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Pressable
        onPress={toggle}
        style={{ position: "absolute", top: insets.top + 8, right: 16, zIndex: 10, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}
      >
        {dark ? <Sun size={15} color={t.text} /> : <Moon size={15} color={t.text} />}
      </Pressable>

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 26, paddingVertical: insets.top + 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <KMonogram size={48} />
          <Text style={{ fontSize: 26, color: t.text, fontFamily: font.display.extrabold, marginTop: 14, letterSpacing: -0.5 }}>kelentane</Text>
          <Text style={{ fontSize: 13, color: t.sub, marginTop: 2, fontFamily: font.body.regular }}>
            {view === "login" ? "Suivi GPS & télématique" : "Créer un compte"}
          </Text>
        </View>

        {view === "login" ? (
          <LoginView t={t} onRegister={() => setView("register")} onForgot={() => setForgot(true)} />
        ) : (
          <RegisterView t={t} onBack={() => setView("login")} />
        )}
      </ScrollView>

      <BottomSheet t={t} visible={forgot} onClose={() => setForgot(false)}>
        <ForgotContent t={t} onClose={() => setForgot(false)} />
      </BottomSheet>
    </View>
  );
}

function LoginView({ t, onRegister, onForgot }: { t: ReturnType<typeof useTheme>["t"]; onRegister: () => void; onForgot: () => void }) {
  const { signIn } = useAuth();
  const [id, setId] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canSubmit = id.trim().length > 0 && pwd.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || loading) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(id, pwd);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Field t={t} label="Identifiant" icon={UserRound} placeholder="kelentane-001" value={id} onChangeText={(v) => { setId(v); setError(null); }} />
      <Field t={t} label="Mot de passe" icon={KeyRound} placeholder="••••••" secure value={pwd} onChangeText={(v) => { setPwd(v); setError(null); }} />
      {error ? <ErrLine t={t} msg={error} /> : null}
      <PrimaryBtn t={t} label={loading ? "Connexion…" : "Se connecter"} enabled={canSubmit && !loading} onPress={submit} />
      <Pressable onPress={onRegister} style={{ marginTop: 10, padding: 13, borderRadius: 14, alignItems: "center", backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
        <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.bold }}>Créer un compte</Text>
      </Pressable>
      <Pressable onPress={onForgot} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.semibold }}>Mot de passe oublié ?</Text>
      </Pressable>
    </>
  );
}

function RegisterView({ t, onBack }: { t: ReturnType<typeof useTheme>["t"]; onBack: () => void }) {
  const { signUp, checkUsername } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [taken, setTaken] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const suggestion = useMemo(() => suggestUsername(fullName, phone), [fullName, phone]);
  useEffect(() => {
    if (!touched) setUsername(suggestion);
  }, [suggestion, touched]);

  // vérif disponibilité (debounce)
  useEffect(() => {
    const u = username.trim();
    if (u.length < 1) return setTaken(false);
    const id = setTimeout(async () => setTaken(!(await checkUsername(u))), 400);
    return () => clearTimeout(id);
  }, [username, checkUsername]);

  const phoneDigits = phone.replace(/\D/g, "");
  const canSubmit = fullName.trim().length > 1 && phoneDigits.length >= 9 && username.trim().length > 0 && !taken && pwd.length >= 4 && pwd === pwd2;

  const submit = async () => {
    if (taken) return setErr("Ce nom d'utilisateur est déjà pris — modifie-le pour continuer.");
    if (!canSubmit || loading) return setErr(pwd !== pwd2 ? "Les mots de passe ne correspondent pas." : "Vérifie les champs.");
    setErr(null);
    setLoading(true);
    try {
      await signUp({ fullName, phone, username, password: pwd });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Field t={t} label="Nom complet" icon={UserRound} placeholder="Aliou Diop" value={fullName} onChangeText={(v) => { setFullName(v); setErr(null); }} />
      <Field t={t} label="Numéro de téléphone" icon={Phone} placeholder="77 123 45 65" keyboardType="phone-pad" value={phone} onChangeText={(v) => { setPhone(v); setErr(null); }} />
      <Field t={t} label="Nom d'utilisateur" icon={Hash} placeholder="Aliou77123" value={username} onChangeText={(v) => { setUsername(v); setTouched(true); setErr(null); }} />
      {taken ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -8, marginBottom: 12, paddingLeft: 2 }}>
          <AlertTriangle size={12} color={ALERT} />
          <Text style={{ fontSize: 11.5, color: ALERT, fontFamily: font.body.medium }}>Déjà pris — choisis un autre nom d'utilisateur.</Text>
        </View>
      ) : (
        <Text style={{ fontSize: 11, color: t.sub, marginTop: -8, marginBottom: 12, paddingLeft: 2, fontFamily: font.body.regular }}>
          Suggéré automatiquement (prénom + 5 premiers chiffres du téléphone) — modifiable.
        </Text>
      )}
      <Field t={t} label="Mot de passe" icon={KeyRound} placeholder="••••••" secure value={pwd} onChangeText={(v) => { setPwd(v); setErr(null); }} />
      <Field t={t} label="Confirmer le mot de passe" icon={KeyRound} placeholder="••••••" secure value={pwd2} onChangeText={(v) => { setPwd2(v); setErr(null); }} />
      {err ? <ErrLine t={t} msg={err} /> : null}
      <PrimaryBtn t={t} label={loading ? "Création…" : "Créer mon compte"} enabled={canSubmit && !loading} onPress={submit} />
      <Pressable onPress={onBack} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.semibold }}>J'ai déjà un compte — Se connecter</Text>
      </Pressable>
    </>
  );
}

function ForgotContent({ t, onClose }: { t: ReturnType<typeof useTheme>["t"]; onClose: () => void }) {
  const [id, setId] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 6 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: hexA(ONLINE, 0.16), marginBottom: 12 }}>
          <Check size={24} color={ONLINE} />
        </View>
        <Text style={{ fontSize: 16, color: t.text, fontFamily: font.display.bold, marginBottom: 6 }}>Demande envoyée</Text>
        <Text style={{ fontSize: 13, color: t.sub, textAlign: "center", marginBottom: 16, fontFamily: font.body.regular }}>
          L'équipe Kelentane te contactera avec un nouveau mot de passe.
        </Text>
        <Pressable onPress={onClose} style={{ width: "100%", padding: 13, borderRadius: 14, alignItems: "center", backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
          <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.bold }}>Fermer</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <>
      <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 2 }}>Mot de passe oublié</Text>
      <Text style={{ fontSize: 12, color: t.sub, marginBottom: 16, fontFamily: font.body.regular }}>
        Contacte Kelentane avec ton identifiant pour recevoir un nouveau mot de passe. Aucune inscription en libre-service : les comptes sont créés par l'équipe.
      </Text>
      <Field t={t} label="Identifiant ou téléphone" icon={UserRound} placeholder="kelentane-001" value={id} onChangeText={setId} />
      <Pressable onPress={() => setSent(true)} style={{ width: "100%", marginTop: 4, padding: 13, borderRadius: 14, alignItems: "center", backgroundColor: ACCENT }}>
        <Text style={{ fontSize: 14, color: LIME_ON, fontFamily: font.body.bold }}>Envoyer la demande</Text>
      </Pressable>
    </>
  );
}

function PrimaryBtn({ t, label, enabled, onPress }: { t: ReturnType<typeof useTheme>["t"]; label: string; enabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!enabled} style={{ width: "100%", marginTop: 6, padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: enabled ? ACCENT : hexA(t.text, 0.12) }}>
      <Text style={{ fontSize: 15, color: enabled ? LIME_ON : t.sub, fontFamily: font.body.bold }}>{label}</Text>
    </Pressable>
  );
}

function ErrLine({ t, msg }: { t: ReturnType<typeof useTheme>["t"]; msg: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: -4, marginBottom: 12, paddingLeft: 2 }}>
      <AlertTriangle size={14} color={ALERT} />
      <Text style={{ flex: 1, fontSize: 12.5, color: ALERT, fontFamily: font.body.medium }}>{msg}</Text>
    </View>
  );
}
