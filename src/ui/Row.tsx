import { Text, TextInput, View } from "react-native";
import { Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import type { LucideIcon } from "../types/models";

type RowProps = {
  t: Theme;
  icon: LucideIcon;
  label: string;
  value: string;
  valueColor?: string;
  mono?: boolean;
  last?: boolean;
};

/** Ligne de lecture (clé → valeur). Maquette : `Row`. */
export function Row({ t, icon: Icon, label, value, valueColor, mono, last }: RowProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.line,
      }}
    >
      <Icon size={17} color={t.sub} />
      <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.regular }}>{label}</Text>
      <Text
        style={{
          flex: 1,
          textAlign: "right",
          fontSize: 13,
          color: valueColor ?? t.text,
          fontFamily: mono ? font.mono.medium : font.body.semibold,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

type EditableProps = {
  t: Theme;
  icon: LucideIcon;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Persistance au blur / validation (base app). */
  onEndEditing?: () => void;
  mono?: boolean;
  last?: boolean;
};

/** Ligne éditable (input souligné pointillé, aligné à droite). Maquette : `EditableRow`. */
export function EditableRow({
  t,
  icon: Icon,
  label,
  value,
  onChangeText,
  onEndEditing,
  mono,
  last,
}: EditableProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.line,
      }}
    >
      <Icon size={17} color={t.sub} />
      <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.regular }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        style={{
          flex: 1,
          textAlign: "right",
          paddingVertical: 2,
          borderBottomWidth: 1,
          borderStyle: "dashed",
          borderBottomColor: t.border,
          color: t.text,
          fontSize: 13,
          fontFamily: mono ? font.mono.medium : font.body.semibold,
        }}
      />
    </View>
  );
}
