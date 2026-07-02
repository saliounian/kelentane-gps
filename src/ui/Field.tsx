import { Text, TextInput, View } from "react-native";
import { Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import type { LucideIcon } from "../types/models";

type Props = {
  t: Theme;
  label: string;
  icon: LucideIcon;
  placeholder?: string;
  value?: string;
  onChangeText?: (v: string) => void;
  secure?: boolean;
  mono?: boolean;
  keyboardType?: "default" | "number-pad" | "phone-pad";
};

/** Champ de saisie (sheets d'ajout, mot de passe). Maquette : `Field`. */
export function Field({
  t,
  label,
  icon: Icon,
  placeholder,
  value,
  onChangeText,
  secure,
  mono,
  keyboardType = "default",
}: Props) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 12,
          color: t.sub,
          marginBottom: 6,
          paddingLeft: 2,
          fontFamily: font.body.semibold,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          height: 48,
          borderRadius: 14,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: t.glass,
          borderWidth: 1,
          borderColor: t.border,
        }}
      >
        <Icon size={18} color={t.sub} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.sub}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          style={{
            flex: 1,
            color: t.text,
            fontSize: 15,
            fontFamily: mono ? font.mono.regular : font.body.regular,
          }}
        />
      </View>
    </View>
  );
}
