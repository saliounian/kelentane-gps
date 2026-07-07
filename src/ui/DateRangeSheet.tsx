import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react-native";
import { ACCENT, hexA, LIME_ON, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { BottomSheet } from "./BottomSheet";

type Props = {
  t: Theme;
  visible: boolean;
  /** Bornes initiales (optionnel) pour ré-ouverture. */
  initialFrom?: Date | null;
  initialTo?: Date | null;
  onApply: (from: Date, to: Date) => void;
  onClose: () => void;
};

const DAY_MS = 86400000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Sélecteur de plage de dates (calendrier JS pur — aucun module natif).
 * Deux taps : premier = début, second = fin. Un tap avant le début redémarre.
 * Suit les règles §1 (feuille remonte avec le clavier / au-dessus de la tab bar).
 */
export function DateRangeSheet({ t, visible, initialFrom, initialTo, onApply, onClose }: Props) {
  const { t: tr } = useTranslation();
  const today = startOfDay(new Date());
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [from, setFrom] = useState<Date | null>(initialFrom ?? null);
  const [to, setTo] = useState<Date | null>(initialTo ?? null);

  const months = tr("cal.months", { returnObjects: true }) as string[];
  const weekdays = tr("cal.weekdays", { returnObjects: true }) as string[];

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // Lundi = 0 (semaine FR)
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const pick = (d: Date) => {
    if (!from || (from && to)) {
      setFrom(d);
      setTo(null);
    } else if (d.getTime() < from.getTime()) {
      setFrom(d);
    } else {
      setTo(d);
    }
  };

  const clear = () => {
    setFrom(null);
    setTo(null);
  };

  const canApply = !!from && !!to;
  const apply = () => {
    if (from && to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      onApply(startOfDay(from), end);
    }
  };

  const inRange = (d: Date): boolean => {
    if (!from) return false;
    const end = to ?? from;
    const lo = Math.min(from.getTime(), end.getTime());
    const hi = Math.max(from.getTime(), end.getTime());
    const dt = d.getTime();
    return dt >= lo && dt <= hi;
  };

  const shiftMonth = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const nextDisabled = cursor.getFullYear() >= today.getFullYear() && cursor.getMonth() >= today.getMonth();

  const fmt = (d: Date | null) => (d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : "—");

  return (
    <BottomSheet t={t} visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 4 }}>{tr("cal.pickRange")}</Text>
      <Text style={{ fontSize: 12.5, color: t.sub, marginBottom: 14, fontFamily: font.body.regular }}>
        {tr("cal.from")} {fmt(from)}  ·  {tr("cal.to")} {fmt(to)}
      </Text>

      {/* nav mois */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
          <ChevronLeft size={18} color={t.text} />
        </Pressable>
        <Text style={{ fontSize: 15, color: t.text, fontFamily: font.body.bold }}>
          {months[cursor.getMonth()]} {cursor.getFullYear()}
        </Text>
        <Pressable onPress={() => !nextDisabled && shiftMonth(1)} disabled={nextDisabled} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.glass, borderWidth: 1, borderColor: t.border, opacity: nextDisabled ? 0.4 : 1 }}>
          <ChevronRight size={18} color={t.text} />
        </Pressable>
      </View>

      {/* en-têtes jours */}
      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        {weekdays.map((w, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: t.sub, fontFamily: font.body.semibold }}>{w}</Text>
        ))}
      </View>

      {/* grille */}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const future = d.getTime() > today.getTime();
          const isFrom = from && sameDay(d, from);
          const isTo = to && sameDay(d, to);
          const edge = isFrom || isTo;
          const within = inRange(d) && !edge;
          return (
            <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
              <Pressable
                onPress={() => !future && pick(d)}
                disabled={future}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: edge ? ACCENT : within ? hexA(ACCENT, 0.16) : "transparent",
                  opacity: future ? 0.28 : 1,
                }}
              >
                <Text style={{ fontSize: 13.5, color: edge ? LIME_ON : t.text, fontFamily: edge ? font.body.bold : font.body.regular }}>
                  {d.getDate()}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* actions */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Pressable onPress={clear} style={{ flex: 1, height: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
          <RotateCcw size={16} color={t.text} />
          <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.semibold }}>{tr("cal.clear")}</Text>
        </Pressable>
        <Pressable onPress={apply} disabled={!canApply} style={{ flex: 2, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: canApply ? ACCENT : hexA(t.text, 0.12) }}>
          <Text style={{ fontSize: 14, color: canApply ? LIME_ON : t.sub, fontFamily: font.body.bold }}>{tr("cal.apply")}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
