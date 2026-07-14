/**
 * Variantes visuelles — OUTIL INTERNE DE COMPARAISON (dev/preview only).
 *
 * Ne modifie JAMAIS la prod tant qu'aucune variante n'est sélectionnée
 * (voir ThemeProvider : variantId === null → tokens d'origine intacts).
 *
 * Une variante ne touche QUE les couleurs et les familles de police —
 * aucune structure / layout / logique. Retirable : supprimer ce dossier,
 * le bloc __DEV__ dans App.tsx, et les mutateurs dans tokens.ts / fonts.ts.
 */
import type { Theme } from "../tokens";

/** Familles de police par slot — miroir exact de l'objet `font` (fonts.ts). */
export type VariantFonts = {
  display: { medium: string; semibold: string; bold: string; extrabold: string; black: string };
  body: { regular: string; medium: string; semibold: string; bold: string };
  mono: { regular: string; medium: string; semibold: string };
};

/** Palette sémantique complète (tokens thème + couleurs statut + texte-sur-accent). */
export type VariantColors = Theme & {
  /** texte foncé posé SUR l'accent (= LIME_ON). */
  accentText: string;
  online: string;
  parked: string;
  offline: string;
  alert: string;
};

export type Variant = {
  id: string;
  name: string;
  tagline: string;
  /** true = fond sombre (StatusBar claire). false = variante claire. */
  isDark: boolean;
  colors: VariantColors;
  fonts: VariantFonts;
};
