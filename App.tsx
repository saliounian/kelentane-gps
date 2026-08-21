import { useEffect, useState, type ComponentType } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Asset } from "expo-asset";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "./src/i18n";
import { useAppFonts } from "./src/theme/fonts";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";

/** [dev/preview] Sélecteur de variante — require() sous __DEV__ : exclu du bundle prod. */
const DevThemeSwitcher: ComponentType | null = __DEV__
  ? require("./src/theme/DevThemeSwitcher").DevThemeSwitcher
  : null;
import { AuthProvider, useAuth } from "./src/state/auth";
import { PrefsProvider } from "./src/state/prefs";
import { IconOverridesProvider } from "./src/state/iconOverrides";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthScreen } from "./src/screens/AuthScreen";
import { BrandLoadingScreen } from "./src/screens/BrandLoadingScreen";
import { RemindersGate } from "./src/screens/RemindersGate";
import { registerForPush } from "./src/data/push";
import { VEHICLE_ASSETS } from "./src/icons/vehicleAssets";

/**
 * Gate racine (handoff §12) : authStatus checking|out|in.
 * Tout l'app (navigation + push) est derrière `status === "in"`.
 */
function Root() {
  const { dark } = useTheme();
  const { status } = useAuth();
  // §5 : durée minimale de l'écran de chargement de marque pour que l'animation
  // (fondu + pulsation + barre dégradée) soit réellement perçue, même si la
  // restauration de session est instantanée. Prend le relais du splash natif.
  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMinElapsed(true), 1400);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (status === "in") void registerForPush();
  }, [status]);

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      {status === "checking" || !minElapsed ? (
        <BrandLoadingScreen />
      ) : status === "out" ? (
        <AuthScreen />
      ) : (
        <>
          <RootNavigator />
          <RemindersGate />
        </>
      )}
      {/* Sélecteur de variante — DEV/PREVIEW UNIQUEMENT (jamais en prod client). */}
      {DevThemeSwitcher ? <DevThemeSwitcher /> : null}
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useAppFonts();

  // §1 : préchauffage disque/mémoire des PNG véhicules dès le démarrage → décodage
  // fait une fois, marqueurs quasi-instantanés à l'ouverture de la carte (en plus
  // du correctif tracksViewChanges). Fire-and-forget, ne bloque pas le rendu.
  useEffect(() => {
    void Asset.loadAsync(Object.values(VEHICLE_ASSETS));
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#F4F6F4" }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PrefsProvider>
            <AuthProvider>
              <IconOverridesProvider>
                <Root />
              </IconOverridesProvider>
            </AuthProvider>
          </PrefsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
