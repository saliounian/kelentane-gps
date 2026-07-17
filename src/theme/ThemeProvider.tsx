import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { theme, Theme } from "./tokens";
import type { Variant } from "./variants";

/**
 * [dev/preview] Le module ./variants (définitions + polices .ttf) n'est chargé
 * QUE via require() sous __DEV__. En prod, Metro élimine la branche → aucun code
 * ni asset de variante dans le bundle client. `import type` ci-dessus est effacé
 * à la compilation (aucune dépendance runtime).
 */
const variantsMod: typeof import("./variants") | null = __DEV__ ? require("./variants") : null;

const THEME_KEY = "theme.dark"; // choix clair/sombre de l'utilisateur (persisté)

type ThemeCtx = {
  t: Theme;
  /** Fond sombre ? Choix utilisateur (toggle). Dérivé de la variante en dev/preview. */
  dark: boolean;
  /** Bascule clair ↔ sombre (persistée). */
  toggle: () => void;
  /** [dev/preview] id de variante active, ou null = prod. */
  variantId: string | null;
  /** [dev/preview] bascule de variante (null = retour prod). */
  setVariant: (id: string | null) => void;
  /** [dev/preview] liste des variantes disponibles (vide en prod). */
  variants: Variant[];
};

const Ctx = createContext<ThemeCtx | null>(null);

/** Fournit le thème « Pin Profond » (clair OU sombre au choix) à toute l'app.
 *  Défaut clair ; le choix est mémorisé (AsyncStorage).
 *  [dev/preview] gère aussi la variante visuelle active (null = prod). */
export function ThemeProvider({ children, initialDark = false }: { children: ReactNode; initialDark?: boolean }) {
  const [dark, setDark] = useState(initialDark);
  const [variantId, setVariantId] = useState<string | null>(null);

  // Restaure le choix clair/sombre au démarrage.
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === "1" || v === "0") setDark(v === "1");
    });
  }, []);

  const value = useMemo<ThemeCtx>(() => {
    // [dev] Applique (ou retire) la variante AVANT de lire theme() : mute tokens + polices.
    // En prod, variantsMod === null → aucun effet, rendu = Pin Profond (clair/sombre selon `dark`).
    const v = variantsMod ? variantsMod.variantById(variantId) : null;
    if (variantsMod) variantsMod.applyVariant(v);
    const effectiveDark = v ? v.isDark : dark;
    return {
      t: theme(effectiveDark),
      dark: effectiveDark,
      toggle: () =>
        setDark((d) => {
          const next = !d;
          void AsyncStorage.setItem(THEME_KEY, next ? "1" : "0");
          return next;
        }),
      variantId,
      setVariant: setVariantId,
      variants: variantsMod ? variantsMod.VARIANTS : [],
    };
  }, [dark, variantId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme doit être utilisé dans <ThemeProvider>");
  return v;
}
