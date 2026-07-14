import type { Variant } from "./types";

/** 5 · Blanc Clinique — light minimal, SaaS aéré, plein jour.
 *  Seule variante claire. Base blanc-bleuté, accent indigo. Sora / Inter / Roboto Mono. */
export const variant5: Variant = {
  id: "blanc-clinique",
  name: "Blanc Clinique",
  tagline: "Light minimal — SaaS aéré, plein jour",
  isDark: false,
  colors: {
    bg: "#F4F6FB",
    text: "#0F1524",
    sub: "rgba(15,21,36,0.58)",
    accent: "#4F46E5",
    accentMuted: "#4F46E5",
    glass: "rgba(255,255,255,0.65)",
    glassSolid: "rgba(255,255,255,0.92)",
    border: "rgba(15,21,36,0.10)",
    line: "rgba(15,21,36,0.07)",
    map1: "#E8EDF6",
    map2: "#DCE4F1",
    accentText: "#FFFFFF",
    online: "#059669",
    parked: "#D97706",
    offline: "#9AA2B1",
    alert: "#DC2626",
  },
  fonts: {
    display: {
      medium: "Sora_500Medium",
      semibold: "Sora_600SemiBold",
      bold: "Sora_700Bold",
      extrabold: "Sora_800ExtraBold",
      black: "Sora_800ExtraBold",
    },
    body: {
      regular: "Inter_400Regular",
      medium: "Inter_500Medium",
      semibold: "Inter_600SemiBold",
      bold: "Inter_700Bold",
    },
    mono: {
      regular: "RobotoMono_400Regular",
      medium: "RobotoMono_500Medium",
      semibold: "RobotoMono_600SemiBold",
    },
  },
};
