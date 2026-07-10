import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Check, RotateCcw, WifiOff, X } from "lucide-react-native";
import { ACCENT, ALERT, hexA, ONLINE, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import type { Command, LucideIcon } from "../types/models";

const META: Record<
  Command["state"],
  { color: string; icon: LucideIcon; title: string; spin?: boolean }
> = {
  pending: { color: ACCENT, icon: RotateCcw, title: "Envoi de la commande…", spin: true },
  success: { color: ONLINE, icon: Check, title: "Commande envoyée au boîtier" },
  offline: { color: ALERT, icon: WifiOff, title: "GPS hors ligne — non transmise" },
  error: { color: ALERT, icon: AlertTriangle, title: "Échec de l'envoi" },
};

type Props = { t: Theme; cmd: Command; onClose: () => void };

/** Toast de retour de commande. Maquette : `CommandToast`. */
export function CommandToast({ t, cmd, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const meta = META[cmd.state];
  const Icon = meta.icon;
  const spin = useRef(new Animated.Value(0)).current;

  // auto-close une fois résolu (assez long pour lire, pas trop)
  useEffect(() => {
    if (cmd.state === "pending") return;
    const id = setTimeout(onClose, 3200);
    return () => clearTimeout(id);
  }, [cmd.state, onClose]);

  // rotation continue en attente
  useEffect(() => {
    if (!meta.spin) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [meta.spin, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    // Overlay plein écran, toast centré verticalement. `box-none` : ne bloque pas
    // les interactions derrière, seul le toast (bouton fermer) est interactif.
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: insets.top, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          maxWidth: 340,
          marginHorizontal: 24,
          borderRadius: 20,
          paddingVertical: 16,
          paddingHorizontal: 18,
          backgroundColor: t.glassSolid,
          borderWidth: 1,
          borderColor: t.border,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 18 },
        }}
      >
        <Animated.View
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: hexA(meta.color, 0.16),
            // `0deg` explicite hors rotation : évite le résidu natif (check penché).
            transform: [{ rotate: meta.spin ? rotate : "0deg" }],
          }}
        >
          <Icon size={24} color={meta.color} />
        </Animated.View>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 15.5, color: t.text, fontFamily: font.body.bold }}>
            {meta.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 12.5, color: t.sub, marginTop: 1, fontFamily: font.body.regular }}
          >
            {cmd.label}
          </Text>
        </View>
        {cmd.state !== "pending" ? (
          <Pressable onPress={onClose} accessibilityLabel="Fermer" hitSlop={8}>
            <X size={17} color={t.sub} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
