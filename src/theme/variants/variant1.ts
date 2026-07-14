import type { Variant } from "./types";

/** 1 · Onyx Lime — ancre = prod actuelle (contrôle de comparaison).
 *  Technique sportif : noir-navy profond, lime marque, Big Shoulders condensé. */
export const variant1: Variant = {
  id: "onyx-lime",
  name: "Onyx Lime",
  tagline: "Technique sportif — ADN actuel (contrôle)",
  isDark: true,
  colors: {
    bg: "#06080F",
    text: "#FFFFFF",
    sub: "rgba(255,255,255,0.58)",
    accent: "#D4FF17",
    accentMuted: "#D4FF17",
    glass: "rgba(255,255,255,0.07)",
    glassSolid: "rgba(20,24,34,0.78)",
    border: "rgba(255,255,255,0.14)",
    line: "rgba(255,255,255,0.09)",
    map1: "#0B1424",
    map2: "#06080F",
    accentText: "#15210A",
    online: "#36D399",
    parked: "#FFB14E",
    offline: "#8E8E93",
    alert: "#FF5C5C",
  },
  fonts: {
    display: {
      medium: "BigShouldersDisplay_500Medium",
      semibold: "BigShouldersDisplay_600SemiBold",
      bold: "BigShouldersDisplay_700Bold",
      extrabold: "BigShouldersDisplay_800ExtraBold",
      black: "BigShouldersDisplay_900Black",
    },
    body: {
      regular: "IBMPlexSans_400Regular",
      medium: "IBMPlexSans_500Medium",
      semibold: "IBMPlexSans_600SemiBold",
      bold: "IBMPlexSans_700Bold",
    },
    mono: {
      regular: "IBMPlexMono_400Regular",
      medium: "IBMPlexMono_500Medium",
      semibold: "IBMPlexMono_600SemiBold",
    },
  },
};
