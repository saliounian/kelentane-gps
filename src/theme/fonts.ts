/**
 * Typographie Kelentane (handoff §4.3 / Annexe A.1).
 *
 * RN ne fait pas de font-stack CSS ni de graisse via fontWeight sur police
 * custom : chaque graisse est une famille distincte. On charge les graisses
 * réellement utilisées et on expose des alias sémantiques.
 *
 *   Big Shoulders Display → titres, noms véhicules, gros chiffres (km/stats)
 *   IBM Plex Sans         → corps
 *   IBM Plex Mono         → données techniques (IMEI, ICCID, immat, valeurs)
 *
 * VARIANTES (dev/preview only) : les familles ci-dessous sont MUTABLES via
 * `__applyFonts` (voir bas de fichier). En prod (aucune variante), l'objet
 * `font` garde exactement les familles Big Shoulders / IBM Plex d'origine.
 */
// Imports profonds (par graisse) : ne bundle QUE les fichiers utilisés.
import { useFonts } from "expo-font";
import BigShouldersDisplay_500Medium from "@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_500Medium.ttf";
import BigShouldersDisplay_600SemiBold from "@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_600SemiBold.ttf";
import BigShouldersDisplay_700Bold from "@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_700Bold.ttf";
import BigShouldersDisplay_800ExtraBold from "@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_800ExtraBold.ttf";
import BigShouldersDisplay_900Black from "@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_900Black.ttf";
import IBMPlexSans_400Regular from "@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf";
import IBMPlexSans_500Medium from "@expo-google-fonts/ibm-plex-sans/500Medium/IBMPlexSans_500Medium.ttf";
import IBMPlexSans_600SemiBold from "@expo-google-fonts/ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf";
import IBMPlexSans_700Bold from "@expo-google-fonts/ibm-plex-sans/700Bold/IBMPlexSans_700Bold.ttf";
import IBMPlexMono_400Regular from "@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf";
import IBMPlexMono_500Medium from "@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf";
import IBMPlexMono_600SemiBold from "@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf";

/* ---------------------------------------------------------------- VARIANTES (dev)
 * Les .ttf des variantes vivent dans ./variants/variantFonts et ne sont chargés
 * QUE via un require() sous `if (__DEV__)` (plus bas). En prod, Metro élimine la
 * branche morte → aucun .ttf de variante dans le bundle client. */

/** Forme de l'objet `font`. */
export type FontSet = {
  display: { medium: string; semibold: string; bold: string; extrabold: string; black: string };
  body: { regular: string; medium: string; semibold: string; bold: string };
  mono: { regular: string; medium: string; semibold: string };
};

/** Familles par défaut (prod — Annexe A.1). Source de vérité restaurée par __applyFonts(null). */
export const DEFAULT_FONTS: FontSet = {
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
};

/**
 * Familles de police actives (= clés enregistrées via useFonts, à passer en fontFamily).
 * Objet MUTABLE à référence stable : les écrans lisent `font.body.regular` inline,
 * donc muter ses valeurs (via __applyFonts) suffit à basculer la typo au re-render.
 */
export const font: FontSet = {
  display: { ...DEFAULT_FONTS.display },
  body: { ...DEFAULT_FONTS.body },
  mono: { ...DEFAULT_FONTS.mono },
};

/** Alias directs (défauts) : DISPLAY = titres, BODY = corps, MONO = données. */
export const DISPLAY = font.display.extrabold;
export const BODY = font.body.regular;
export const MONO = font.mono.regular;

/**
 * [VARIANTES — dev only] Remplace en place les familles de `font`.
 * `null` restaure les familles de prod. Sans effet en prod (jamais appelé).
 */
export function __applyFonts(next: FontSet | null): void {
  const src = next ?? DEFAULT_FONTS;
  Object.assign(font.display, src.display);
  Object.assign(font.body, src.body);
  Object.assign(font.mono, src.mono);
}

/** Polices de base (prod). */
const BASE_FONTS = {
  BigShouldersDisplay_500Medium,
  BigShouldersDisplay_600SemiBold,
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  BigShouldersDisplay_900Black,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
};

/**
 * Polices des variantes — chargées UNIQUEMENT en dev/preview.
 * Le `require` est dans une branche `if (__DEV__)` : en prod, Metro la supprime,
 * donc ./variants/variantFonts (et ses ~3,5 Mo de .ttf) n'entrent pas au bundle.
 */
let VARIANT_FONTS: Record<string, number> = {};
if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  VARIANT_FONTS = require("./variants/variantFonts").VARIANT_FONTS;
}

/** Charge les graisses utilisées (base en prod ; base + variantes en dev). Renvoie [loaded, error]. */
export function useAppFonts() {
  return useFonts({ ...BASE_FONTS, ...VARIANT_FONTS });
}
