import { useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ACCENT, hexA, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import type { DayKm } from "../types/reports";

const WD = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function weekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WD[new Date(y, m - 1, d).getDay()];
}

/** "12/07" — date propre, horizontale (jamais empilée) pour la vue défilable. */
function dayMonth(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

/** Au-delà de 8 barres (30j / longues plages), on défile horizontalement. */
const SCROLL_THRESHOLD = 8;
/** Largeur confortable par barre journalière en mode défilable. */
const BAR_W = 42;

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
  const scroll = days.length > SCROLL_THRESHOLD;
  const scrollRef = useRef<ScrollView>(null);

  const renderBar = (d: DayKm, i: number) => {
    const h = Math.round((d.km / max) * (height - 32)) + 6;
    const on = i === selected;
    return (
      <Pressable
        key={d.date}
        onPress={() => onSelect?.(i)}
        style={
          scroll
            ? { width: BAR_W, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }
            : { flex: 1, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }
        }
      >
        <Text style={{ fontSize: 9.5, color: on ? t.accentMuted : t.sub, fontFamily: font.body.bold }}>{d.km}</Text>
        <View style={{ width: "100%", height: h, borderRadius: 8, backgroundColor: on ? ACCENT : hexA(ACCENT, 0.2) }} />
        <Text style={{ fontSize: scroll ? 9 : 10, color: on ? t.text : t.sub, fontFamily: on ? font.body.bold : font.body.regular }}>
          {scroll ? dayMonth(d.date) : weekday(d.date)}
        </Text>
      </Pressable>
    );
  };

  // Vue 7 jours (et plages courtes) : tout rentre à l'écran, pas de scroll.
  if (!scroll) {
    return (
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 7, height }}>{days.map(renderBar)}</View>
    );
  }

  // Vue 30 jours : défilement horizontal, positionné d'emblée sur les jours récents (fin).
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      contentContainerStyle={{ flexDirection: "row", alignItems: "flex-end", gap: 7, height, paddingHorizontal: 2 }}
    >
      {days.map(renderBar)}
    </ScrollView>
  );
}
