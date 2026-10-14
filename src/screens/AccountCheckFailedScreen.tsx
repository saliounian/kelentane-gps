import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { WifiOff } from "lucide-react-native";
import { ACCENT, ALERT, LIME_ON, hexA } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../state/auth";

/**
 * Gate bloquante : mustChangePasswordStatus === "unknown" (lecture indéterminable
 * — erreur, timeout, ligne absente). FAIL-CLOSED : ne JAMAIS laisser entrer dans
 * l'app sur une valeur indéterminée. Rendu à la place de RootNavigator (App.tsx),
 * comme ForcedPasswordChangeScreen — pas de "plus tard".
 */
export function AccountCheckFailedScreen() {
  const { t } = useTheme();
  const { t: tr } = useTranslation();
  const { retryMustChangePasswordCheck, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await retryMustChangePasswordCheck();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 36, paddingHorizontal: 20, alignItems: "center" }}>
      <View style={{ width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: hexA(ALERT, 0.12), marginBottom: 14 }}>
        <WifiOff size={26} color={ALERT} />
      </View>
      <Text style={{ fontSize: 20, color: t.text, fontFamily: font.display.extrabold, textAlign: "center", marginBottom: 6 }}>
        {tr("accountCheck.title")}
      </Text>
      <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.regular, textAlign: "center", paddingHorizontal: 8, marginBottom: 26 }}>
        {tr("accountCheck.desc")}
      </Text>

      <Pressable
        onPress={retry}
        disabled={retrying}
        style={{ width: "100%", padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: retrying ? hexA(ACCENT, 0.5) : ACCENT, marginBottom: 10 }}
      >
        <Text style={{ fontSize: 15, color: LIME_ON, fontFamily: font.body.bold }}>
          {retrying ? tr("accountCheck.retrying") : tr("accountCheck.retry")}
        </Text>
      </Pressable>
      <Pressable onPress={() => void signOut()} style={{ padding: 12, alignItems: "center" }}>
        <Text style={{ fontSize: 14, color: t.sub, fontFamily: font.body.semibold }}>{tr("accountCheck.logout")}</Text>
      </Pressable>
    </View>
  );
}
