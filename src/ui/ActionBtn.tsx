import { Pressable, Text } from "react-native";
import { ACCENT, LIME_ON, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import type { LucideIcon } from "../types/models";

type Props = {
  t: Theme;
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  /** Action principale (fond lime, texte LIME_ON). */
  primary?: boolean;
};

/** Bouton d'action compact (popup carte). Maquette : `ActionBtn`. */
export function ActionBtn({ t, icon: Icon, label, onPress, primary }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 6,
        gap: 4,
        alignItems: "center",
        backgroundColor: primary ? ACCENT : "transparent",
        borderWidth: primary ? 0 : 1,
        borderColor: "rgba(128,128,128,0.25)",
      }}
    >
      <Icon size={17} color={primary ? LIME_ON : t.text} />
      <Text
        style={{
          fontSize: 11,
          color: primary ? LIME_ON : t.text,
          fontFamily: font.body.semibold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
