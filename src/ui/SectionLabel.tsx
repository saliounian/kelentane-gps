import { ReactNode } from "react";
import { Text } from "react-native";
import { Theme } from "../theme/tokens";
import { font } from "../theme/fonts";

/** Titre de section (paramètres, listes). Maquette : `SectionLabel`. */
export function SectionLabel({ t, children }: { t: Theme; children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 13,
        color: t.sub,
        paddingHorizontal: 22,
        paddingBottom: 8,
        fontFamily: font.body.bold,
      }}
    >
      {children}
    </Text>
  );
}

/** Variante inline (au fil du contenu, sans padding latéral fort). */
export function SectionLabelInline({ t, children }: { t: Theme; children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 13,
        color: t.sub,
        paddingLeft: 4,
        marginTop: 16,
        marginBottom: 8,
        fontFamily: font.body.bold,
      }}
    >
      {children}
    </Text>
  );
}
