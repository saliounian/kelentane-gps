/**
 * POLICES DES VARIANTES — DEV/PREVIEW ONLY.
 *
 * Ce module n'est JAMAIS importé statiquement : il est `require()` uniquement
 * dans un bloc `if (__DEV__)` (voir fonts.ts). En build de production, Metro
 * remplace `__DEV__` par `false`, supprime la branche morte, et donc ce module
 * — ET tous les .ttf ci-dessous (~3,5 Mo) — n'entrent pas dans le bundle client.
 *
 * Retirable : supprimer ce fichier + le bloc `if (__DEV__)` dans fonts.ts.
 */
import SpaceGrotesk_500Medium from "@expo-google-fonts/space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf";
import SpaceGrotesk_600SemiBold from "@expo-google-fonts/space-grotesk/600SemiBold/SpaceGrotesk_600SemiBold.ttf";
import SpaceGrotesk_700Bold from "@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf";
import Inter_400Regular from "@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf";
import Inter_500Medium from "@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf";
import Inter_600SemiBold from "@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf";
import Inter_700Bold from "@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf";
import JetBrainsMono_400Regular from "@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf";
import JetBrainsMono_500Medium from "@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf";
import JetBrainsMono_600SemiBold from "@expo-google-fonts/jetbrains-mono/600SemiBold/JetBrainsMono_600SemiBold.ttf";
import Archivo_400Regular from "@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf";
import Archivo_500Medium from "@expo-google-fonts/archivo/500Medium/Archivo_500Medium.ttf";
import Archivo_600SemiBold from "@expo-google-fonts/archivo/600SemiBold/Archivo_600SemiBold.ttf";
import Archivo_700Bold from "@expo-google-fonts/archivo/700Bold/Archivo_700Bold.ttf";
import ChakraPetch_500Medium from "@expo-google-fonts/chakra-petch/500Medium/ChakraPetch_500Medium.ttf";
import ChakraPetch_600SemiBold from "@expo-google-fonts/chakra-petch/600SemiBold/ChakraPetch_600SemiBold.ttf";
import ChakraPetch_700Bold from "@expo-google-fonts/chakra-petch/700Bold/ChakraPetch_700Bold.ttf";
import Sora_500Medium from "@expo-google-fonts/sora/500Medium/Sora_500Medium.ttf";
import Sora_600SemiBold from "@expo-google-fonts/sora/600SemiBold/Sora_600SemiBold.ttf";
import Sora_700Bold from "@expo-google-fonts/sora/700Bold/Sora_700Bold.ttf";
import Sora_800ExtraBold from "@expo-google-fonts/sora/800ExtraBold/Sora_800ExtraBold.ttf";
import RobotoMono_400Regular from "@expo-google-fonts/roboto-mono/400Regular/RobotoMono_400Regular.ttf";
import RobotoMono_500Medium from "@expo-google-fonts/roboto-mono/500Medium/RobotoMono_500Medium.ttf";
import RobotoMono_600SemiBold from "@expo-google-fonts/roboto-mono/600SemiBold/RobotoMono_600SemiBold.ttf";
import BricolageGrotesque_500Medium from "@expo-google-fonts/bricolage-grotesque/500Medium/BricolageGrotesque_500Medium.ttf";
import BricolageGrotesque_600SemiBold from "@expo-google-fonts/bricolage-grotesque/600SemiBold/BricolageGrotesque_600SemiBold.ttf";
import BricolageGrotesque_700Bold from "@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf";
import BricolageGrotesque_800ExtraBold from "@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf";

/** Map { familleEnregistrée: module } à passer à useFonts (dev/preview only). */
export const VARIANT_FONTS: Record<string, number> = {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  ChakraPetch_500Medium,
  ChakraPetch_600SemiBold,
  ChakraPetch_700Bold,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
  RobotoMono_400Regular,
  RobotoMono_500Medium,
  RobotoMono_600SemiBold,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
};
