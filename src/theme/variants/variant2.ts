import type { Variant } from "./types";

/** 2 · Ardoise Cuivre — premium sobre, exécutif.
 *  Ardoise chaude, accent cuivre. Space Grotesk / Inter / JetBrains Mono. */
export const variant2: Variant = {
  id: "ardoise-cuivre",
  name: "Ardoise Cuivre",
  tagline: "Premium sobre — exécutif, calme",
  isDark: true,
  colors: {
    bg: "#12110E",
    text: "#F4EFE7",
    sub: "rgba(244,239,231,0.55)",
    accent: "#E8A15A",
    glass: "rgba(255,245,230,0.06)",
    glassSolid: "rgba(33,30,24,0.82)",
    border: "rgba(255,245,230,0.13)",
    line: "rgba(255,245,230,0.08)",
    map1: "#1D1A14",
    map2: "#12110E",
    accentText: "#1C1206",
    online: "#5FB98E",
    parked: "#D9A441",
    offline: "#8A857C",
    alert: "#E5695C",
  },
  fonts: {
    display: {
      medium: "SpaceGrotesk_500Medium",
      semibold: "SpaceGrotesk_600SemiBold",
      bold: "SpaceGrotesk_700Bold",
      extrabold: "SpaceGrotesk_700Bold",
      black: "SpaceGrotesk_700Bold",
    },
    body: {
      regular: "Inter_400Regular",
      medium: "Inter_500Medium",
      semibold: "Inter_600SemiBold",
      bold: "Inter_700Bold",
    },
    mono: {
      regular: "JetBrainsMono_400Regular",
      medium: "JetBrainsMono_500Medium",
      semibold: "JetBrainsMono_600SemiBold",
    },
  },
};
