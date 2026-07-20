import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react-native";
import { ACCENT, LIME_ON } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { fetchKm, type Range } from "../data/reports";
import { toUserMessage } from "../data/errorMessages";
import { BarChart, DateRangeSheet, ErrorState, Glass, GlassButton, Skeleton } from "../ui";
import type { RootStackParamList } from "../navigation/types";
import type { KmReport } from "../types/reports";

const fmtShort = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export function KmScreen() {
  const { t, dark } = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "Km">>();
  const [mode, setMode] = useState<Range>("7d");
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [perso, setPerso] = useState(false);
  const [data, setData] = useState<KmReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let from: string | undefined;
        let to: string | undefined;
        if (mode === "custom") {
          if (!customFrom || !customTo) return; // plage pas encore choisie
          from = customFrom.toISOString();
          to = customTo.toISOString();
        }
        const r = await fetchKm(params.vehicleId, mode, from, to);
        if (alive) {
          setData(r);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(toUserMessage(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.vehicleId, mode, customFrom, customTo, nonce]);

  const customLabel = mode === "custom" && customFrom && customTo ? `${fmtShort(customFrom)}–${fmtShort(customTo)}` : tr("km.custom");
  const chips: { id: Range; label: string }[] = [
    { id: "7d", label: tr("km.d7") },
    { id: "30d", label: tr("km.d30") },
    { id: "custom", label: customLabel },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40, paddingHorizontal: 14, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <GlassButton t={t} icon={ChevronLeft} onPress={() => nav.goBack()} />
          <Text style={{ fontSize: 21, color: t.text, fontFamily: font.display.extrabold }}>{tr("km.title")}</Text>
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
          <ErrorState t={t} message={error} onRetry={() => setNonce((n) => n + 1)} />
        ) : !data ? (
          // §5 : page entière qui charge → skeleton (total + graphe + tuiles).
          <View style={{ gap: 12 }}>
            <Skeleton t={t} height={110} radius={16} />
            <Skeleton t={t} height={160} radius={16} />
            <Skeleton t={t} height={72} radius={16} />
          </View>
        ) : (
          <>
            <Glass t={t} dark={dark} style={{ padding: 16 }}>
              <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>{tr("km.totalInterval")}</Text>
              <Text style={{ fontSize: 44, color: t.text, fontFamily: font.display.black, letterSpacing: -1 }}>
                {data.total}
                <Text style={{ fontSize: 16, color: t.sub, fontFamily: font.body.semibold }}> km</Text>
              </Text>
              <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>{tr("km.perDay", { n: data.avgPerDay })}</Text>
            </Glass>

            <Glass t={t} dark={dark} style={{ padding: 14 }}>
              <BarChart t={t} days={data.days} />
            </Glass>

            <Text style={{ fontSize: 13, color: t.sub, paddingLeft: 4, marginTop: 4, fontFamily: font.body.bold }}>
              {tr("km.totalByVehicle")}
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

      <DateRangeSheet
        t={t}
        visible={perso}
        initialFrom={customFrom}
        initialTo={customTo}
        onApply={(from, to) => {
          setCustomFrom(from);
          setCustomTo(to);
          setMode("custom");
          setPerso(false);
        }}
        onClose={() => setPerso(false)}
      />
    </View>
  );
}
