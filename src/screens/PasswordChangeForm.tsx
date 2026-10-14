import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react-native";
import { ACCENT, LIME_ON, hexA, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { supabase } from "../data/supabase";
import { logError, toUserMessage } from "../data/errorMessages";
import { Field } from "../ui";

/** Rejette "123456" et les suites triviales évidentes (tout identique, séquence
 *  strictement croissante/décroissante de chiffres OU de lettres — "012345",
 *  "654321", "abcdef", "fedcba", quelques classiques "password"/"azerty"...). */
function isTrivialPassword(pwd: string): boolean {
  const p = pwd.trim().toLowerCase();
  if (p === "123456") return true;
  if (/^(.)\1+$/.test(p)) return true; // ex. "aaaaaa", "111111"
  if (/^[a-z]+$/.test(p) || /^\d+$/.test(p)) {
    const chars = p.split("");
    const asc = chars.every((c, i) => i === 0 || c.charCodeAt(0) === chars[i - 1].charCodeAt(0) + 1);
    const desc = chars.every((c, i) => i === 0 || c.charCodeAt(0) === chars[i - 1].charCodeAt(0) - 1);
    if (asc || desc) return true; // ex. "012345", "654321", "abcdef", "fedcba"
  }
  const common = ["password", "motdepasse", "azertyuiop", "qwertyuiop", "00000000", "12345678", "87654321"];
  return common.includes(p);
}

export interface PasswordChangeFormProps {
  t: Theme;
  /** Longueur minimale. Défaut 4 = comportement historique du changement volontaire. */
  minLength?: number;
  /** Rejette "123456" et suites triviales. Défaut false (comportement historique). */
  rejectTrivial?: boolean;
  submitLabel?: string;
  /** Affiché dans la zone de message après succès (sinon la zone est juste vidée). */
  successMessage?: string;
  /** Appelé après une mise à jour réussie de supabase.auth.updateUser. */
  onSuccess?: () => void;
  /** Désactive le bouton depuis le parent (ex. relecture du flag en cours après succès). */
  busy?: boolean;
  /** Texte d'aide affiché sous les champs (absent par défaut = comportement historique). */
  hint?: string;
}

/**
 * Formulaire de changement de mot de passe COMPTE (supabase.auth.updateUser).
 * Partagé entre ProfileScreen (changement volontaire, règles historiques) et
 * ForcedPasswordChange (nudge bloquant walk-up IMEI, règles renforcées).
 */
export function PasswordChangeForm({
  t,
  minLength = 4,
  rejectTrivial = false,
  submitLabel,
  successMessage,
  onSuccess,
  busy = false,
  hint,
}: PasswordChangeFormProps) {
  const { t: tr } = useTranslation();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const p = pwd.trim();
    const p2 = pwd2.trim();
    if (p.length < minLength || p !== p2) {
      // Comportement historique (rejectTrivial=false) : un seul message générique,
      // inchangé. Mode renforcé : message précis selon le cas.
      if (!rejectTrivial) return setMsg(tr("profile.pwdRule"));
      return setMsg(p.length < minLength ? tr("profile.pwdTooShort", { n: minLength }) : tr("profile.pwdMismatch"));
    }
    if (rejectTrivial && isTrivialPassword(p)) return setMsg(tr("profile.pwdTooTrivial"));

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: p });
    setSaving(false);
    if (error) {
      logError("PasswordChangeForm.updatePwd", error);
      return setMsg(toUserMessage(error));
    }
    setPwd("");
    setPwd2("");
    setMsg(successMessage ?? null);
    onSuccess?.();
  };

  return (
    <View>
      <Field t={t} label={tr("profile.newPwd")} icon={KeyRound} placeholder="••••••" secure value={pwd} onChangeText={(v) => { setPwd(v); setMsg(null); }} />
      {hint ? <Text style={{ fontSize: 11.5, color: t.sub, marginTop: -6, marginBottom: 10, fontFamily: font.body.regular }}>{hint}</Text> : null}
      <Field t={t} label={tr("profile.confirm")} icon={KeyRound} placeholder="••••••" secure value={pwd2} onChangeText={(v) => { setPwd2(v); setMsg(null); }} />
      {msg ? <Text style={{ fontSize: 12.5, color: t.sub, marginBottom: 8, fontFamily: font.body.regular }}>{msg}</Text> : null}
      <Pressable
        onPress={save}
        disabled={saving || busy}
        style={{ padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: saving || busy ? hexA(ACCENT, 0.5) : ACCENT }}
      >
        <Text style={{ fontSize: 15, color: LIME_ON, fontFamily: font.body.bold }}>
          {saving ? tr("profile.saving") : submitLabel ?? tr("profile.update")}
        </Text>
      </Pressable>
    </View>
  );
}

export { isTrivialPassword };
