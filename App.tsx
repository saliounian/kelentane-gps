import { useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "./src/i18n";
import { useAppFonts } from "./src/theme/fonts";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { AuthProvider, useAuth } from "./src/state/auth";
import { PrefsProvider } from "./src/state/prefs";
import { IconOverridesProvider } from "./src/state/iconOverrides";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthScreen, SessionSplash } from "./src/screens/AuthScreen";
import { RemindersGate } from "./src/screens/RemindersGate";
import { registerForPush } from "./src/data/push";

/**
 * Gate racine (handoff §12) : authStatus checking|out|in.
 * Tout l'app (navigation + push) est derrière `status === "in"`.
 */
function Root() {
  const { dark } = useTheme();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "in") void registerForPush();
  }, [status]);

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      {status === "checking" ? (
        <SessionSplash />
      ) : status === "out" ? (
        <AuthScreen />
      ) : (
        <>
          <RootNavigator />
          <RemindersGate />
        </>
      )}
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#06080F" }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initialDark>
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
