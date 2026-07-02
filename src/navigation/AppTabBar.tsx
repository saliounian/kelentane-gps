import { BlurView } from "expo-blur";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, Bell, Home, List, User } from "lucide-react-native";
import { ACCENT } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import type { LucideIcon } from "../types/models";

const ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  map: { icon: Home, label: "Carte" },
  list: { icon: List, label: "Véhicules" },
  alarm: { icon: Bell, label: "Alarmes" },
  stats: { icon: BarChart3, label: "Stats" },
  me: { icon: User, label: "Profil" },
};

/** TabBar flottante en verre, pilotée par react-navigation. Maquette : `TabBar`. */
export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { t, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: Math.max(insets.bottom, 12),
        borderRadius: 26,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: t.border,
        shadowColor: "#000",
        shadowOpacity: dark ? 0.5 : 0.25,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 12 },
      }}
    >
      <BlurView intensity={dark ? 30 : 45} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          paddingVertical: 8,
          paddingHorizontal: 6,
          backgroundColor: t.glass,
        }}
      >
        {state.routes.map((route, i) => {
          const meta = ICONS[route.name];
          if (!meta) return null;
          const on = state.index === i;
          const Icon = meta.icon;
          const onPress = () => {
            const evt = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!on && !evt.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 }}
            >
              <Icon size={21} color={on ? ACCENT : t.sub} strokeWidth={on ? 2.4 : 2} />
              <Text
                style={{
                  fontSize: 9.5,
                  color: on ? ACCENT : t.sub,
                  fontFamily: on ? font.body.bold : font.body.medium,
                }}
              >
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
