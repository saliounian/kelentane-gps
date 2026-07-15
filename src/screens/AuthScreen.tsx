import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ChevronDown, Hash, KeyRound, Phone, Trash2, UserRound } from "lucide-react-native";
import { ACCENT, ALERT, hexA, LIME_ON, ONLINE } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth, suggestUsername } from "../state/auth";
import { addIdentifierToHistory, getIdentifierHistory, rememberedIdentifier, removeIdentifierFromHistory } from "../data/authStorage";
import { BottomSheet, Field, KMonogram, Toggle } from "../ui";

/** Écran de vérification de session (authStatus === "checking"). */
export function SessionSplash() {
  const { t } = useTheme();
  const { t: tr } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", gap: 14 }}>
      <KMonogram />
      <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>{tr("auth.sessionCheck")}</Text>
    </View>
  );
}

/** Gate racine quand authStatus === "out" : connexion + auto-inscription. */
export function AuthScreen() {
  const { t } = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<"login" | "register">("login");
  const [forgot, setForgot] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 26, paddingVertical: insets.top + 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <KMonogram size={48} />
          <Text style={{ fontSize: 26, color: t.text, fontFamily: font.display.extrabold, marginTop: 14, letterSpacing: -0.5 }}>kelentane</Text>
          <Text style={{ fontSize: 13, color: t.sub, marginTop: 2, fontFamily: font.body.regular }}>
            {view === "login" ? tr("auth.tagline") : tr("auth.createAccount")}
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
  const { t: tr } = useTranslation();
  const [id, setId] = useState("");
  const [pwd, setPwd] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const canSubmit = id.trim().length > 0 && pwd.trim().length > 0;

  // §1 : pré-remplir le DERNIER identifiant + l'état du switch, et charger l'historique
  // multi-comptes (liste déroulante). Jamais le mot de passe.
  useEffect(() => {
    rememberedIdentifier().then(({ identifier, remember }) => {
      if (identifier) setId(identifier);
      setRemember(remember);
    });
    getIdentifierHistory().then(setHistory);
  }, []);

  const submit = async () => {
    if (!canSubmit || loading) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(id, pwd, remember);
      // Historique alimenté UNIQUEMENT après une connexion réussie.
      await addIdentifierToHistory(id);
      setHistory(await getIdentifierHistory());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Suppression d'un compte de l'historique (appui long → confirmation courte).
  const confirmDelete = (item: string) => {
    Alert.alert(tr("auth.removeAccountTitle"), tr("auth.removeAccountMsg", { id: item }), [
      { text: tr("common.cancel"), style: "cancel" },
      {
        text: tr("common.delete"),
        style: "destructive",
        onPress: () => void removeIdentifierFromHistory(item).then(setHistory),
      },
    ]);
  };

  return (
    <>
      <IdentifierField
        t={t}
        label={tr("auth.identifier")}
        value={id}
        history={history}
        onChangeText={(v) => { setId(v); setError(null); }}
        onSelect={(v) => { setId(v); setError(null); }}
        onLongPressItem={confirmDelete}
      />
      <Field t={t} label={tr("auth.password")} icon={KeyRound} placeholder="••••••" secure value={pwd} onChangeText={(v) => { setPwd(v); setError(null); }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: -4, marginBottom: 12, paddingLeft: 2 }}>
        <Toggle t={t} on={remember} set={setRemember} />
        <Text style={{ fontSize: 13, color: t.text, fontFamily: font.body.semibold }}>{tr("auth.rememberMe")}</Text>
      </View>
      {error ? <ErrLine t={t} msg={error} /> : null}
      <PrimaryBtn t={t} label={loading ? tr("auth.loggingIn") : tr("auth.login")} enabled={canSubmit && !loading} onPress={submit} />
      <Pressable onPress={onRegister} style={{ marginTop: 10, padding: 13, borderRadius: 14, alignItems: "center", backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
        <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.bold }}>{tr("auth.createAccount")}</Text>
      </Pressable>
      <Pressable onPress={onForgot} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.semibold }}>{tr("auth.forgot")}</Text>
      </Pressable>
    </>
  );
}

function RegisterView({ t, onBack }: { t: ReturnType<typeof useTheme>["t"]; onBack: () => void }) {
  const { signUp, checkUsername } = useAuth();
  const { t: tr } = useTranslation();
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

  useEffect(() => {
    const u = username.trim();
    if (u.length < 1) return setTaken(false);
    const id = setTimeout(async () => setTaken(!(await checkUsername(u))), 400);
    return () => clearTimeout(id);
  }, [username, checkUsername]);

  // Téléphone NON bloquant (§4) : l'inscription se finalise sans numéro.
  const canSubmit = fullName.trim().length > 1 && username.trim().length > 0 && !taken && pwd.length >= 4 && pwd === pwd2;

  const submit = async () => {
    if (taken) return setErr(tr("auth.usernameTakenLong"));
    if (!canSubmit || loading) return setErr(pwd !== pwd2 ? tr("auth.pwdMismatch") : tr("auth.checkFields"));
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
      <Field t={t} label={tr("auth.fullName")} icon={UserRound} placeholder="Aliou Diop" value={fullName} onChangeText={(v) => { setFullName(v); setErr(null); }} />
      <Field t={t} label={tr("auth.phoneOpt")} icon={Phone} placeholder="77 123 45 65" keyboardType="phone-pad" value={phone} onChangeText={(v) => { setPhone(v); setErr(null); }} />
      <Field t={t} label={tr("auth.username")} icon={Hash} placeholder="Aliou77123" value={username} onChangeText={(v) => { setUsername(v); setTouched(true); setErr(null); }} />
      {taken ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -8, marginBottom: 12, paddingLeft: 2 }}>
          <AlertTriangle size={12} color={ALERT} />
          <Text style={{ fontSize: 11.5, color: ALERT, fontFamily: font.body.medium }}>{tr("auth.usernameTaken")}</Text>
        </View>
      ) : (
        <Text style={{ fontSize: 11, color: t.sub, marginTop: -8, marginBottom: 12, paddingLeft: 2, fontFamily: font.body.regular }}>
          {tr("auth.usernameHint")}
        </Text>
      )}
      <Field t={t} label={tr("auth.password")} icon={KeyRound} placeholder="••••••" secure value={pwd} onChangeText={(v) => { setPwd(v); setErr(null); }} />
      <Field t={t} label={tr("auth.confirmPassword")} icon={KeyRound} placeholder="••••••" secure value={pwd2} onChangeText={(v) => { setPwd2(v); setErr(null); }} />
      {err ? <ErrLine t={t} msg={err} /> : null}
      <PrimaryBtn t={t} label={loading ? tr("auth.creating") : tr("auth.createMyAccount")} enabled={canSubmit && !loading} onPress={submit} />
      <Pressable onPress={onBack} style={{ marginTop: 16, alignItems: "center" }}>
        <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.semibold }}>{tr("auth.haveAccount")}</Text>
      </Pressable>
    </>
  );
}

function ForgotContent({ t, onClose }: { t: ReturnType<typeof useTheme>["t"]; onClose: () => void }) {
  const { t: tr } = useTranslation();
  const [id, setId] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 6 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: hexA(ONLINE, 0.16), marginBottom: 12 }}>
          <Check size={24} color={ONLINE} />
        </View>
        <Text style={{ fontSize: 16, color: t.text, fontFamily: font.display.bold, marginBottom: 6 }}>{tr("auth.requestSent")}</Text>
        <Text style={{ fontSize: 13, color: t.sub, textAlign: "center", marginBottom: 16, fontFamily: font.body.regular }}>
          {tr("auth.requestSentDesc")}
        </Text>
        <Pressable onPress={onClose} style={{ width: "100%", padding: 13, borderRadius: 14, alignItems: "center", backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
          <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.bold }}>{tr("common.close")}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <>
      <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 2 }}>{tr("auth.forgotTitle")}</Text>
      <Text style={{ fontSize: 12, color: t.sub, marginBottom: 16, fontFamily: font.body.regular }}>{tr("auth.forgotDesc")}</Text>
      <Field t={t} label={tr("auth.forgotField")} icon={UserRound} placeholder="kelentane-001" value={id} onChangeText={setId} />
      <Pressable onPress={() => setSent(true)} style={{ width: "100%", marginTop: 4, padding: 13, borderRadius: 14, alignItems: "center", backgroundColor: ACCENT }}>
        <Text style={{ fontSize: 14, color: LIME_ON, fontFamily: font.body.bold }}>{tr("auth.sendRequest")}</Text>
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

/**
 * Champ identifiant avec liste déroulante d'historique multi-comptes (§1).
 * Tap chevron → ouvre la liste (plus récent en premier). Tap ligne → pré-remplit
 * SEULEMENT (pas d'auto-login). Appui long → suppression (confirmation courte).
 */
function IdentifierField({
  t,
  label,
  value,
  history,
  onChangeText,
  onSelect,
  onLongPressItem,
}: {
  t: ReturnType<typeof useTheme>["t"];
  label: string;
  value: string;
  history: string[];
  onChangeText: (v: string) => void;
  onSelect: (v: string) => void;
  onLongPressItem: (v: string) => void;
}) {
  const { t: tr } = useTranslation();
  const [open, setOpen] = useState(false);
  const hasHistory = history.length > 0;

  return (
    <View style={{ marginBottom: 12, zIndex: 20 }}>
      <Text style={{ fontSize: 12, color: t.sub, marginBottom: 6, paddingLeft: 2, fontFamily: font.body.semibold }}>{label}</Text>
      <View style={{ height: 48, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
        <UserRound size={18} color={t.sub} />
        <TextInput
          value={value}
          onChangeText={(v) => { onChangeText(v); setOpen(false); }}
          placeholder="kelentane-001"
          placeholderTextColor={t.sub}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, color: t.text, fontSize: 15, fontFamily: font.body.regular }}
        />
        {hasHistory ? (
          <Pressable onPress={() => setOpen((o) => !o)} hitSlop={10} accessibilityLabel={tr("auth.showAccounts")}>
            <ChevronDown size={18} color={t.sub} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
          </Pressable>
        ) : null}
      </View>

      {open && hasHistory ? (
        <View
          style={{
            position: "absolute",
            top: 74,
            left: 0,
            right: 0,
            borderRadius: 14,
            backgroundColor: t.glassSolid,
            borderWidth: 1,
            borderColor: t.border,
            overflow: "hidden",
            zIndex: 30,
            elevation: 8,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          {history.map((item, i) => (
            <Pressable
              key={item}
              onPress={() => { onSelect(item); setOpen(false); }}
              onLongPress={() => onLongPressItem(item)}
              android_ripple={{ color: hexA(t.text, 0.08) }}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.line }}
            >
              <UserRound size={15} color={t.sub} />
              <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 14, fontFamily: font.body.medium }}>{item}</Text>
              <Trash2 size={14} color={t.sub} />
            </Pressable>
          ))}
          <Text style={{ fontSize: 10.5, color: t.sub, paddingHorizontal: 12, paddingVertical: 6, fontFamily: font.body.regular }}>{tr("auth.longPressDelete")}</Text>
        </View>
      ) : null}
    </View>
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
