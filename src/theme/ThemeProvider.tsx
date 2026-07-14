import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { theme, Theme } from "./tokens";
import type { Variant } from "./variants";

/**
 * [dev/preview] Le module ./variants (définitions + polices .ttf) n'est chargé
 * QUE via require() sous __DEV__. En prod, Metro élimine la branche → aucun code
 * ni asset de variante dans le bundle client. `import type` ci-dessus est effacé
 * à la compilation (aucune dépendance runtime).
 */
const variantsMod: typeof import("./variants") | null = __DEV__ ? require("./variants") : null;

type ThemeCtx = {
  t: Theme;
  dark: boolean;
  toggle: () => void;
  /** [dev/preview] id de variante active, ou null = prod. */
  variantId: string | null;
  /** [dev/preview] bascule de variante (null = retour prod). */
  setVariant: (id: string | null) => void;
  /** [dev/preview] liste des variantes disponibles (vide en prod). */
  variants: Variant[];
};

const Ctx = createContext<ThemeCtx | null>(null);

/** Fournit le thème + bascule dark/light à toute l'app.
 *  [dev/preview] gère aussi la variante visuelle active (null = prod inchangée). */
export function ThemeProvider({ children, initialDark = true }: { children: ReactNode; initialDark?: boolean }) {
  const [dark, setDark] = useState(initialDark);
  const [variantId, setVariantId] = useState<string | null>(null);

  const value = useMemo<ThemeCtx>(() => {
    // [dev] Applique (ou retire) la variante AVANT de lire theme() : mute tokens + polices.
    // En prod, variantsMod === null → aucun effet, tokens d'origine intacts.
    const v = variantsMod ? variantsMod.variantById(variantId) : null;
    if (variantsMod) variantsMod.applyVariant(v);
    const effectiveDark = v ? v.isDark : dark;
    return {
      t: theme(effectiveDark),
      dark: effectiveDark,
      toggle: () => setDark((d) => !d),
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
