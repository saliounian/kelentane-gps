import { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react-native";
import { ALERT, hexA } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../state/auth";
import { PasswordChangeForm } from "./PasswordChangeForm";

/**
 * Gate bloquante (§2 walk-up IMEI) : le compte utilise encore le mot de passe
 * par défaut (clients.must_change_password = true). Aucun retour, aucun "plus
 * tard" — contrairement à RemindersGate (rappels non-bloquants), cet écran
 * remplace ENTIÈREMENT la navigation jusqu'à un changement de mot de passe
 * effectif (voir App.tsx : rendu à la place de RootNavigator, pas en plus).
 */
export function ForcedPasswordChangeScreen() {
  const { t } = useTheme();
  const { t: tr } = useTranslation();
  const { recheckMustChangePassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSuccess = async () => {
    setErr(null);
    setChecking(true);
    try {
      // Le trigger Postgres recalcule must_change_password à l'update d'auth.users ;
      // on relit pour confirmer avant de laisser entrer. ok=false = indéterminable
      // (timeout/erreur) → jamais laissé passer. required=true (même ok=true) =
      // le flag est toujours actif (ex. nouveau mdp qui vaut encore le défaut).
      const { ok, required } = await recheckMustChangePassword();
      if (!ok) setErr(tr("forcedPwd.checkFailed"));
      else if (required) setErr(tr("forcedPwd.stillRequired"));
      // Sinon (ok && !required) : le contexte passe mustChangePasswordStatus à "ok",
      // App.tsx re-rend automatiquement l'app normale — rien d'autre à faire ici.
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 36, paddingHorizontal: 20 }}>
      <View style={{ alignItems: "center", marginBottom: 26 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: hexA(ALERT, 0.12), marginBottom: 14 }}>
          <ShieldAlert size={26} color={ALERT} />
        </View>
        <Text style={{ fontSize: 20, color: t.text, fontFamily: font.display.extrabold, textAlign: "center", marginBottom: 6 }}>
          {tr("forcedPwd.title")}
        </Text>
        <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.regular, textAlign: "center", paddingHorizontal: 8 }}>
          {tr("forcedPwd.desc")}
        </Text>
      </View>

      <PasswordChangeForm
        t={t}
        minLength={6}
        rejectTrivial
        submitLabel={tr("forcedPwd.submit")}
        onSuccess={handleSuccess}
        busy={checking}
        hint={tr("forcedPwd.pwdHint")}
      />

      {checking ? (
        <Text style={{ fontSize: 12.5, color: t.sub, marginTop: 14, textAlign: "center", fontFamily: font.body.regular }}>
          {tr("forcedPwd.checking")}
        </Text>
      ) : err ? (
        <Text style={{ fontSize: 12.5, color: ALERT, marginTop: 14, textAlign: "center", fontFamily: font.body.regular }}>
          {err}
        </Text>
      ) : null}
    </View>
  );
}
