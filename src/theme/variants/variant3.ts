import type { Variant } from "./types";

/** 3 · Sahel Solaire — vibrant sportif, chaud, haut contraste.
 *  Charbon chaud, accent orange solaire. Big Shoulders / Archivo / IBM Plex Mono. */
export const variant3: Variant = {
  id: "sahel-solaire",
  name: "Sahel Solaire",
  tagline: "Vibrant sportif — chaud, haut contraste",
  isDark: true,
  colors: {
    bg: "#161009",
    text: "#FFF3E8",
    sub: "rgba(255,243,232,0.58)",
    accent: "#FF6A2C",
    accentMuted: "#FF6A2C",
    glass: "rgba(255,235,220,0.06)",
    glassSolid: "rgba(36,26,16,0.82)",
    border: "rgba(255,235,220,0.14)",
    line: "rgba(255,235,220,0.08)",
    map1: "#23180E",
    map2: "#161009",
    accentText: "#1A0A02",
    online: "#2DD4BF",
    parked: "#FBBF24",
    offline: "#94836F",
    alert: "#F43F5E",
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
      regular: "Archivo_400Regular",
      medium: "Archivo_500Medium",
      semibold: "Archivo_600SemiBold",
      bold: "Archivo_700Bold",
    },
    mono: {
      regular: "IBMPlexMono_400Regular",
      medium: "IBMPlexMono_500Medium",
      semibold: "IBMPlexMono_600SemiBold",
    },
  },
};
