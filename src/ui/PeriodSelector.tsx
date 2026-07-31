import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ACCENT, LIME_ON, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { DateRangeSheet } from "./DateRangeSheet";
import type { Range } from "../data/reports";

const fmtShort = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

type Props = {
  t: Theme;
  mode: Range;
  customFrom: Date | null;
  customTo: Date | null;
  /** Émis à chaque changement de période (chip 7j/30j, ou plage Perso appliquée). */
  onChange: (mode: Range, from: Date | null, to: Date | null) => void;
};

/**
 * Sélecteur de période partagé (Km + Stats) : 7 jours / 30 jours / Perso.
 * Encapsule les chips et la feuille calendrier pour un comportement identique
 * sur les deux écrans (handoff — cohérence Km/Stats).
 */
export function PeriodSelector({ t, mode, customFrom, customTo, onChange }: Props) {
  const { t: tr } = useTranslation();
  const [perso, setPerso] = useState(false);

  const customLabel =
    mode === "custom" && customFrom && customTo ? `${fmtShort(customFrom)}–${fmtShort(customTo)}` : tr("km.custom");
  const chips: { id: Range; label: string }[] = [
    { id: "7d", label: tr("km.d7") },
    { id: "30d", label: tr("km.d30") },
    { id: "custom", label: customLabel },
  ];

  return (
    <>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {chips.map((c) => {
          const on = mode === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => (c.id === "custom" ? setPerso(true) : onChange(c.id, customFrom, customTo))}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: on ? ACCENT : t.glass, borderWidth: 1, borderColor: on ? ACCENT : t.border }}
            >
              <Text style={{ fontSize: 13, color: on ? LIME_ON : t.text, fontFamily: font.body.semibold }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <DateRangeSheet
        t={t}
        visible={perso}
        initialFrom={customFrom}
        initialTo={customTo}
        onApply={(from, to) => {
          onChange("custom", from, to);
          setPerso(false);
        }}
        onClose={() => setPerso(false)}
      />
    </>
  );
}
