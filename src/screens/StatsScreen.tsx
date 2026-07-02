import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ACCENT, ALERT, LIME_ON, ONLINE } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useVehicles } from "../data/useVehicles";
import { fetchStats } from "../data/reports";
import { BarChart, Glass, Metric } from "../ui";
import type { StatsReport } from "../types/reports";

export function StatsScreen() {
  const { t, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { vehicles } = useVehicles();
  const [vid, setVid] = useState<number | null>(null);
  const [data, setData] = useState<StatsReport | null>(null);
  const [sel, setSel] = useState(6);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vid === null && vehicles.length) setVid(vehicles[0].id);
  }, [vehicles, vid]);

  useEffect(() => {
    if (vid === null) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetchStats(vid, "7d");
        if (!alive) return;
        setData(r);
        setSel(Math.max(0, r.days.length - 1));
        setError(null);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [vid]);

  const dayKm = data?.days[sel]?.km ?? 0;
  const dayLabel = useMemo(() => {
    const d = data?.days[sel]?.date;
    if (!d) return "";
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }, [data, sel]);

  const a = data?.activity;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 110, paddingHorizontal: 14, gap: 12 }}>
        <Text style={{ fontSize: 26, color: t.text, fontFamily: font.display.extrabold, letterSpacing: -0.5, paddingHorizontal: 4 }}>
          Statistiques
        </Text>

        {/* sélecteur véhicule */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
          {vehicles.map((v) => {
            const on = v.id === vid;
            return (
              <Pressable
                key={v.id}
                onPress={() => setVid(v.id)}
                style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? ACCENT : t.glass, borderWidth: 1, borderColor: on ? ACCENT : t.border }}
              >
                <Text style={{ fontSize: 13, color: on ? LIME_ON : t.text, fontFamily: font.body.semibold }}>{v.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <Text style={{ color: t.sub, textAlign: "center", marginTop: 20, fontFamily: font.body.regular }}>{error}</Text>
        ) : !data ? (
          <Text style={{ color: t.sub, textAlign: "center", marginTop: 20, fontFamily: font.body.regular }}>Chargement…</Text>
        ) : (
          <>
            {/* jour sélectionné */}
            <Glass t={t} dark={dark} style={{ padding: 16 }}>
              <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>{dayLabel}</Text>
              <Text style={{ fontSize: 46, color: t.text, fontFamily: font.display.black, letterSpacing: -1 }}>
                {dayKm}
                <Text style={{ fontSize: 18, color: t.sub, fontFamily: font.body.semibold }}> km</Text>
              </Text>
            </Glass>

            <Glass t={t} dark={dark} style={{ padding: 14 }}>
              <BarChart t={t} days={data.days} selected={sel} onSelect={setSel} />
            </Glass>

            {/* résumé hebdo */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Metric t={t} label="Total semaine" value={`${data.total}`} unit="km" />
              <Metric t={t} label="Moyenne / j" value={`${data.avgPerDay}`} unit="km" />
              <Metric t={t} label="Jour max" value={`${data.maxDay}`} unit="km" />
            </View>

            {/* activité */}
            <Text style={{ fontSize: 13, color: t.sub, paddingLeft: 4, marginTop: 4, fontFamily: font.body.bold }}>
              Activité de la semaine
            </Text>
            {a ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <View style={{ width: "48%" }}><Metric t={t} label="Temps de conduite" value={a.drive} small /></View>
                <View style={{ width: "48%" }}><Metric t={t} label="Temps à l'arrêt" value={a.idle} small /></View>
                <View style={{ width: "48%" }}><Metric t={t} label="Trajets" value={`${a.trips}`} /></View>
                <View style={{ width: "48%" }}><Metric t={t} label="Arrêts" value={`${a.stops}`} /></View>
                <View style={{ width: "48%" }}><Metric t={t} label="Vitesse moy" value={`${a.avg}`} unit="km/h" /></View>
                <View style={{ width: "48%" }}><Metric t={t} label="Vitesse max" value={`${a.max}`} unit="km/h" /></View>
                <View style={{ width: "48%" }}>
                  <Metric t={t} label="Excès de vitesse" value={`${a.over}`} valueColor={a.over > 0 ? ALERT : ONLINE} small />
                </View>
                <View style={{ width: "48%" }}><Metric t={t} label="Jours actifs" value={`${a.days}/7`} small /></View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
