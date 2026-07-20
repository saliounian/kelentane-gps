import { useEffect, useRef } from "react";
import { Animated, View, type ViewStyle } from "react-native";
import { Theme } from "../theme/tokens";

/**
 * §5 — Squelette de chargement (skeleton). À utiliser pour une PAGE/section entière
 * qui charge (liste Véhicules, Stats, historique Trajectoire, ouverture Détail),
 * jamais pour une action ciblée (là : spinner inline). Pulse d'opacité léger,
 * neutre clair/sombre (pas de couleur de marque : c'est un placeholder, pas un état).
 */
export function Skeleton({ t, width, height = 14, radius = 8, style }: { t: Theme; width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle }) {
  const op = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.85, duration: 650, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [op]);
  return (
    <Animated.View
      style={[{ width: width ?? "100%", height, borderRadius: radius, backgroundColor: t.glass, borderWidth: 1, borderColor: t.line, opacity: op }, style]}
    />
  );
}

/** Rangée squelette façon carte de liste (icône + deux lignes de texte + valeur). */
export function SkeletonRow({ t }: { t: Theme }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 18, backgroundColor: t.glass, borderWidth: 1, borderColor: t.line }}>
      <Skeleton t={t} width={44} height={44} radius={13} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton t={t} width="55%" height={13} />
        <Skeleton t={t} width="80%" height={11} />
      </View>
      <Skeleton t={t} width={40} height={22} radius={6} />
    </View>
  );
}
