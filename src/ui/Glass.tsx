import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { Theme } from "../theme/tokens";

type Props = {
  t: Theme;
  dark: boolean;
  children?: ReactNode;
  radius?: number;
  intensity?: number;
  /** Style appliqué à la couche de contenu (padding, gap, etc.). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Surface « Liquid Glass » : BlurView en fond + couche translucide bordée.
 * Remplace le `backdrop-filter` web (indisponible en RN). Handoff §4.4.
 */
export function Glass({ t, dark, children, radius = 22, intensity, style }: Props) {
  return (
    <View style={{ borderRadius: radius, overflow: "hidden" }}>
      <BlurView
        intensity={intensity ?? (dark ? 30 : 40)}
        tint={dark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          {
            borderRadius: radius,
            borderWidth: 1,
            borderColor: t.border,
            backgroundColor: t.glass,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
