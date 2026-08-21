import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeProvider";
import { BRAND_LIME, BrandLockupV, PIN_DEEP } from "../ui/BrandLogo";

/**
 * Écran de chargement de marque (§5) — affiché juste APRÈS le splash natif statique,
 * pendant le chargement réel (restauration de session, premières positions véhicules).
 * Lockup vertical Kelentane en fondu + pulsation douce ; barre de progression
 * dégradée vert Pin → lime en bas. 100 % Animated (API core RN, aucune dép native
 * supplémentaire) pour minimiser la surface de build.
 *
 * `progress` : 0→1 si connu. Absent → barre indéterminée (va-et-vient) pendant que
 * la durée du chargement est inconnue.
 */
export function BrandLoadingScreen({ progress }: { progress?: number }) {
  const { t, dark } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  // Apparition (fondu + légère montée) puis pulsation continue du lockup.
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fade, pulse]);

  // Barre indéterminée : un segment qui balaie de gauche à droite en boucle.
  useEffect(() => {
    if (progress != null) return;
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, sweep]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });
  const translateY = fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const wordColor = dark ? "#F4F6F4" : "#101513";

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ opacity: fade, transform: [{ translateY }, { scale }] }}>
        <BrandLockupV size={128} wordColor={wordColor} framed />
      </Animated.View>

      {/* Barre de progression bas d'écran — dégradé vert Pin → lime. */}
      <View style={{ position: "absolute", left: 40, right: 40, bottom: 64 }}>
        <View style={{ height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: dark ? "rgba(255,255,255,0.10)" : "rgba(10,92,66,0.12)" }}>
          {progress != null ? (
            <View style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, height: 5 }}>
              <LinearGradient colors={[PIN_DEEP, BRAND_LIME]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
            </View>
          ) : (
            <Animated.View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "42%",
                left: sweep.interpolate({ inputRange: [0, 1], outputRange: ["-42%", "100%"] }),
              }}
            >
              <LinearGradient colors={[PIN_DEEP, BRAND_LIME]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 3 }} />
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}
