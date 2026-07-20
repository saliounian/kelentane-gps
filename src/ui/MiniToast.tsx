import { useEffect } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle } from "lucide-react-native";
import { ALERT, hexA, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";

/**
 * §5 — Petit toast d'erreur pour les actions OPTIMISTES (renommage, géofence,
 * alarme lue) : le changement est appliqué tout de suite, et si l'appel échoue on
 * rollback puis on l'annonce discrètement ici. Message DÉJÀ traduit
 * (`toUserMessage`) — jamais d'exception brute. Auto-fermeture ~3 s.
 */
export function MiniToast({ t, message, onClose }: { t: Theme; message: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const id = setTimeout(onClose, 3200);
    return () => clearTimeout(id);
  }, [message, onClose]);

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 92, alignItems: "center", zIndex: 1000 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          maxWidth: 380,
          borderRadius: 14,
          paddingVertical: 11,
          paddingHorizontal: 14,
          backgroundColor: t.glassSolid,
          borderWidth: 1,
          borderColor: hexA(ALERT, 0.4),
        }}
      >
        <AlertTriangle size={15} color={ALERT} />
        <Text style={{ flexShrink: 1, fontSize: 12.5, color: t.text, lineHeight: 17, fontFamily: font.body.regular }}>{message}</Text>
      </View>
    </View>
  );
}
