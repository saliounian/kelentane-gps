import { Pressable } from "react-native";
import { Theme } from "../theme/tokens";
import type { LucideIcon } from "../types/models";

type Props = {
  t: Theme;
  icon: LucideIcon;
  onPress?: () => void;
  /** 34 = iconBtn (maquette), 38 = ctrlBtn (contrôles carte). */
  size?: 34 | 38;
  /** Couleur d'icône (défaut t.text ; ACCENT pour sélection). */
  color?: string;
  accessibilityLabel?: string;
};

/** Bouton rond en verre. Maquette : helpers `iconBtn` / `ctrlBtn`. */
export function GlassButton({ t, icon: Icon, onPress, size = 34, color, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderRadius: size === 38 ? 13 : 11,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.glass,
        borderWidth: 1,
        borderColor: t.border,
      }}
    >
      <Icon size={17} color={color ?? t.text} />
    </Pressable>
  );
}
