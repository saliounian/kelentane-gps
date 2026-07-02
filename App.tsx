import { useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { theme } from "./src/theme/tokens";
import { useAppFonts } from "./src/theme/fonts";
import { Gallery } from "./src/dev/Gallery";

/**
 * Point d'entrée. Étape 1 : rend la galerie /ui (écran de dev).
 * Sera remplacé par le vrai chrome + navigation à l'étape 3.
 */
export default function App() {
  const [dark, setDark] = useState(true);
  const [fontsLoaded] = useAppFonts();
  const t = theme(dark);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: dark ? "#06080F" : "#DFE7F0" }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Gallery t={t} dark={dark} toggleDark={() => setDark((d) => !d)} />
    </View>
  );
}
