import { Pressable, Text, View } from "react-native";
import { ACCENT, hexA, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import type { DayKm } from "../types/reports";

const WD = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function weekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WD[new Date(y, m - 1, d).getDay()];
}

type Props = {
  t: Theme;
  days: DayKm[];
  selected?: number;
  onSelect?: (i: number) => void;
  height?: number;
};

/** Barres km/jour. Sélection = accent (jamais un statut). */
export function BarChart({ t, days, selected, onSelect, height = 150 }: Props) {
  const max = Math.max(...days.map((d) => d.km), 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 7, height }}>
      {days.map((d, i) => {
        const h = Math.round((d.km / max) * (height - 32)) + 6;
        const on = i === selected;
        return (
          <Pressable
            key={d.date}
            onPress={() => onSelect?.(i)}
            style={{ flex: 1, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}
          >
            <Text style={{ fontSize: 9.5, color: on ? t.accentMuted : t.sub, fontFamily: font.body.bold }}>{d.km}</Text>
            <View style={{ width: "100%", height: h, borderRadius: 8, backgroundColor: on ? ACCENT : hexA(ACCENT, 0.2) }} />
            <Text style={{ fontSize: 10, color: on ? t.text : t.sub, fontFamily: on ? font.body.bold : font.body.regular }}>
              {weekday(d.date)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
