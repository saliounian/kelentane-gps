/**
 * Registre des variantes visuelles (dev/preview only).
 * `applyVariant(null)` = retour prod (tokens + polices d'origine).
 */
import { __applyVariant } from "../tokens";
import { __applyFonts } from "../fonts";
import type { Variant } from "./types";
import { variant1 } from "./variant1";
import { variant2 } from "./variant2";
import { variant3 } from "./variant3";
import { variant4 } from "./variant4";
import { variant5 } from "./variant5";
import { variant6 } from "./variant6";
import { variant7 } from "./variant7";

export type { Variant } from "./types";

export const VARIANTS: Variant[] = [
  variant1,
  variant2,
  variant3,
  variant4,
  variant5,
  variant6,
  variant7,
];

/** id de la variante = prod (aucune surcharge). */
export const PROD_VARIANT_ID = null;

export function variantById(id: string | null): Variant | null {
  if (!id) return null;
  return VARIANTS.find((v) => v.id === id) ?? null;
}

/** Applique une variante (ou la retire si null). Mute tokens + polices en place. */
export function applyVariant(v: Variant | null): void {
  if (v) {
    __applyVariant({
      theme: v.colors,
      accent: v.colors.accent,
      accentText: v.colors.accentText,
      online: v.colors.online,
      parked: v.colors.parked,
      offline: v.colors.offline,
      alert: v.colors.alert,
    });
    __applyFonts(v.fonts);
  } else {
    __applyVariant(null);
    __applyFonts(null);
  }
}
