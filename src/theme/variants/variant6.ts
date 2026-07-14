import type { Variant } from "./types";

/** 6 · Vert Émeraude — logistique confiance, vert autorité.
 *  Forêt profond, accent émeraude (online tiré vers le teal pour rester distinct).
 *  Sora / Inter / IBM Plex Mono. */
export const variant6: Variant = {
  id: "vert-emeraude",
  name: "Vert Émeraude",
  tagline: "Logistique confiance — vert autorité",
  isDark: true,
  colors: {
    bg: "#08150F",
    text: "#EAF6EF",
    sub: "rgba(234,246,239,0.55)",
    accent: "#10B981",
    accentMuted: "#10B981",
    glass: "rgba(220,255,235,0.06)",
    glassSolid: "rgba(18,35,26,0.82)",
    border: "rgba(220,255,235,0.13)",
    line: "rgba(220,255,235,0.08)",
    map1: "#0C2118",
    map2: "#08150F",
    accentText: "#03130C",
    online: "#2DD4BF",
    parked: "#E0A93C",
    offline: "#7E8C84",
    alert: "#F16A6A",
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
      regular: "IBMPlexMono_400Regular",
      medium: "IBMPlexMono_500Medium",
      semibold: "IBMPlexMono_600SemiBold",
    },
  },
};
