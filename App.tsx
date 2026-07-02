import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect } from "react";
import { useAppFonts } from "./src/theme/fonts";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { IconOverridesProvider } from "./src/state/iconOverrides";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { registerForPush } from "./src/data/push";

function Root() {
  const { dark } = useTheme();
  useEffect(() => {
    // scaffold push (enregistrement du jeton ; envoi réel différé — voir docs/PLAN.md)
    void registerForPush();
  }, []);
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <RootNavigator />
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
          <IconOverridesProvider>
            <Root />
          </IconOverridesProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
