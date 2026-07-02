import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";

/** Écran à venir (Alarmes/Stats/Profil), construits aux étapes suivantes. */
export function PlaceholderScreen({ title, step }: { title: string; step: string }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8, paddingHorizontal: 18 }}>
      <Text style={{ fontSize: 26, color: t.text, fontFamily: font.display.extrabold, letterSpacing: -0.5 }}>
        {title}
      </Text>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 }}>
        <Text style={{ fontSize: 14, color: t.sub, fontFamily: font.body.regular }}>À venir · {step}</Text>
      </View>
    </View>
  );
}
