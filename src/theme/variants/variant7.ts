import type { Variant } from "./types";

/** 7 · Terracotta Sable — African-modern chaud, brand-forward.
 *  Brun profond, accent terracotta. Bricolage Grotesque / Inter / JetBrains Mono. */
export const variant7: Variant = {
  id: "terracotta-sable",
  name: "Terracotta Sable",
  tagline: "African-modern chaud — brand-forward",
  isDark: true,
  colors: {
    bg: "#1A130D",
    text: "#F6ECE0",
    sub: "rgba(246,236,224,0.55)",
    accent: "#E2683A",
    glass: "rgba(255,240,225,0.06)",
    glassSolid: "rgba(42,30,21,0.82)",
    border: "rgba(255,240,225,0.13)",
    line: "rgba(255,240,225,0.08)",
    map1: "#271A11",
    map2: "#1A130D",
    accentText: "#1A0A03",
    online: "#4FB98A",
    parked: "#E9AC46",
    offline: "#94867A",
    alert: "#E14B4B",
  },
  fonts: {
    display: {
      medium: "BricolageGrotesque_500Medium",
      semibold: "BricolageGrotesque_600SemiBold",
      bold: "BricolageGrotesque_700Bold",
      extrabold: "BricolageGrotesque_800ExtraBold",
      black: "BricolageGrotesque_800ExtraBold",
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
