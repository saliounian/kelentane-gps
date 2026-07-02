import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";
import { ACCENT, hexA, LIME_ON } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { fetchKm, type Range } from "../data/reports";
import { BarChart, BottomSheet, Glass, GlassButton } from "../ui";
import type { RootStackParamList } from "../navigation/types";
import type { KmReport } from "../types/reports";

const DAY_MS = 86400000;
const PRESETS = [14, 60, 90];

export function KmScreen() {
  const { t, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "Km">>();
  const [mode, setMode] = useState<Range>("7d");
  const [customDays, setCustomDays] = useState(14);
  const [perso, setPerso] = useState(false);
  const [data, setData] = useState<KmReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let from: string | undefined;
        let to: string | undefined;
        if (mode === "custom") {
          const end = new Date();
          const start = new Date(end.getTime() - (customDays - 1) * DAY_MS);
          start.setHours(0, 0, 0, 0);
          from = start.toISOString();
          to = end.toISOString();
        }
        const r = await fetchKm(params.vehicleId, mode, from, to);
        if (alive) {
          setData(r);
          setError(null);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.vehicleId, mode, customDays]);

  const chips: { id: Range; label: string }[] = [
    { id: "7d", label: "7 jours" },
    { id: "30d", label: "30 jours" },
    { id: "custom", label: mode === "custom" ? `${customDays} j` : "Perso" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40, paddingHorizontal: 14, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <GlassButton t={t} icon={ChevronLeft} onPress={() => nav.goBack()} />
          <Text style={{ fontSize: 21, color: t.text, fontFamily: font.display.extrabold }}>Kilométrage</Text>
        </View>

        {/* intervalle */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {chips.map((c) => {
            const on = mode === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => (c.id === "custom" ? setPerso(true) : setMode(c.id))}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: on ? ACCENT : t.glass, borderWidth: 1, borderColor: on ? ACCENT : t.border }}
              >
                <Text style={{ fontSize: 13, color: on ? LIME_ON : t.text, fontFamily: font.body.semibold }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Text style={{ color: t.sub, textAlign: "center", marginTop: 20, fontFamily: font.body.regular }}>{error}</Text>
        ) : !data ? (
          <Text style={{ color: t.sub, textAlign: "center", marginTop: 20, fontFamily: font.body.regular }}>Chargement…</Text>
        ) : (
          <>
            <Glass t={t} dark={dark} style={{ padding: 16 }}>
              <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>Total sur l'intervalle</Text>
              <Text style={{ fontSize: 44, color: t.text, fontFamily: font.display.black, letterSpacing: -1 }}>
                {data.total}
                <Text style={{ fontSize: 16, color: t.sub, fontFamily: font.body.semibold }}> km</Text>
              </Text>
              <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>≈ {data.avgPerDay} km / jour</Text>
            </Glass>

            <Glass t={t} dark={dark} style={{ padding: 14 }}>
              <BarChart t={t} days={data.days} />
            </Glass>

            <Text style={{ fontSize: 13, color: t.sub, paddingLeft: 4, marginTop: 4, fontFamily: font.body.bold }}>
              Total par véhicule
            </Text>
            <Glass t={t} dark={dark} style={{ padding: 4 }}>
              {data.byVehicle.map((v, i) => (
                <View
                  key={v.id}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: i === data.byVehicle.length - 1 ? 0 : 1, borderBottomColor: t.line }}
                >
                  <Text style={{ flex: 1, fontSize: 14, color: t.text, fontFamily: font.body.semibold }}>{v.name}</Text>
                  <Text style={{ fontSize: 15, color: t.text, fontFamily: font.mono.semibold }}>
                    {v.total}
                    <Text style={{ fontSize: 10, color: t.sub }}> km</Text>
                  </Text>
                </View>
              ))}
            </Glass>
          </>
        )}
      </ScrollView>

      <BottomSheet t={t} visible={perso} onClose={() => setPerso(false)}>
        <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, paddingHorizontal: 4, marginBottom: 4 }}>
          Intervalle personnalisé
        </Text>
        <Text style={{ fontSize: 12, color: t.sub, paddingHorizontal: 4, marginBottom: 12, fontFamily: font.body.regular }}>
          Derniers jours (sélecteur calendrier précis : à venir).
        </Text>
        {PRESETS.map((d) => (
          <Pressable
            key={d}
            onPress={() => {
              setCustomDays(d);
              setMode("custom");
              setPerso(false);
            }}
            style={{ paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, marginBottom: 8, backgroundColor: hexA(ACCENT, 0.1) }}
          >
            <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.semibold }}>{d} derniers jours</Text>
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}
