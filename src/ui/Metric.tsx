import { Text, View } from "react-native";
import { Theme } from "../theme/tokens";
import { font } from "../theme/fonts";

type Props = {
  t: Theme;
  label: string;
  value: string;
  unit?: string;
  /** Valeur en mono (données techniques) plutôt qu'en display. */
  mono?: boolean;
  /** Couleur de valeur + point (statut/connexion). */
  valueColor?: string;
  /** Variante compacte (texte au lieu de gros chiffre). */
  small?: boolean;
};

/** Tuile valeur + label (métriques véhicule). Maquette : `Metric`. */
export function Metric({ t, label, value, unit, mono, valueColor, small }: Props) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: t.glass,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: 13,
        paddingVertical: 9,
        paddingHorizontal: 6,
        alignItems: "center",
      }}
    >
      <Text style={{ color: t.sub, fontSize: 10, marginBottom: 3, fontFamily: font.body.regular }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {valueColor ? (
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: valueColor }} />
        ) : null}
        <Text
          style={{
            color: valueColor ?? t.text,
            fontSize: small ? 14 : 19,
            letterSpacing: -0.3,
            fontFamily: mono
              ? font.mono.semibold
              : small
                ? font.display.bold
                : font.display.extrabold,
          }}
        >
          {value}
          {unit ? (
            <Text style={{ color: t.sub, fontSize: 10, fontFamily: font.body.medium }}> {unit}</Text>
          ) : null}
        </Text>
      </View>
    </View>
  );
}
