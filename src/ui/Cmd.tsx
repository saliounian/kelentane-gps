import { Pressable, Text, View } from "react-native";
import { ACCENT, ALERT, hexA, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import type { LucideIcon } from "../types/models";

type Props = {
  t: Theme;
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  /** Action de marque (accent). */
  primary?: boolean;
  /** Action dangereuse (coupure moteur). */
  danger?: boolean;
  /** État actif/sélectionné (bordure + fond teinté). */
  active?: boolean;
};

/** Bouton de commande (grille Détail). Maquette : `Cmd`. */
export function Cmd({ t, icon: Icon, label, onPress, primary, danger, active }: Props) {
  const base = danger ? ALERT : primary ? ACCENT : t.text;
  const c = active ? (danger ? ALERT : ACCENT) : base;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 16,
        padding: 14,
        gap: 8,
        alignItems: "flex-start",
        backgroundColor: active ? hexA(c, 0.12) : t.glass,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? c : t.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hexA(c, 0.16),
        }}
      >
        <Icon size={18} color={c} />
      </View>
      <Text style={{ fontSize: 13, color: t.text, fontFamily: font.body.semibold }}>{label}</Text>
    </Pressable>
  );
}
