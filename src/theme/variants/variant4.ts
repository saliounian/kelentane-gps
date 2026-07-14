import type { Variant } from "./types";

/** 4 · Bleu Nuit Cyan — control-room / télémétrie HUD.
 *  Bleu profond, accent cyan électrique. Chakra Petch / IBM Plex Sans / IBM Plex Mono. */
export const variant4: Variant = {
  id: "bleu-nuit-cyan",
  name: "Bleu Nuit Cyan",
  tagline: "Control-room télémétrie — HUD",
  isDark: true,
  colors: {
    bg: "#0A1220",
    text: "#EAF6FF",
    sub: "rgba(234,246,255,0.55)",
    accent: "#22D3EE",
    accentMuted: "#22D3EE",
    glass: "rgba(210,235,255,0.06)",
    glassSolid: "rgba(19,32,51,0.82)",
    border: "rgba(210,235,255,0.14)",
    line: "rgba(210,235,255,0.08)",
    map1: "#0E1B30",
    map2: "#0A1220",
    accentText: "#04141A",
    online: "#34D399",
    parked: "#F5B942",
    offline: "#7B8AA0",
    alert: "#FB6A72",
  },
  fonts: {
    display: {
      medium: "ChakraPetch_500Medium",
      semibold: "ChakraPetch_600SemiBold",
      bold: "ChakraPetch_700Bold",
      extrabold: "ChakraPetch_700Bold",
      black: "ChakraPetch_700Bold",
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
