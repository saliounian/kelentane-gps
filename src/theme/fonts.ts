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
 */
// Imports profonds (par graisse) : ne bundle QUE les 12 fichiers utilisés,
// pas les ~40 .ttf (italiques inclus) des paquets complets — clé pour le poids
// de l'app sur réseau faible (Sénégal).
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

/** Familles de police (= clés enregistrées via useFonts, à passer en fontFamily). */
export const font = {
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
} as const;

/** Alias directs (défauts) : DISPLAY = titres, BODY = corps, MONO = données. */
export const DISPLAY = font.display.extrabold;
export const BODY = font.body.regular;
export const MONO = font.mono.regular;

/** Charge toutes les graisses utilisées. Renvoie [loaded, error]. */
export function useAppFonts() {
  return useFonts({
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
  });
}
