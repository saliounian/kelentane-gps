import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react-native";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { fetchKm, type Range } from "../data/reports";
import { toUserMessage } from "../data/errorMessages";
import { BarChart, ErrorState, Glass, GlassButton, PeriodSelector, Skeleton } from "../ui";
import type { RootStackParamList } from "../navigation/types";
import type { KmReport } from "../types/reports";

export function KmScreen() {
  const { t, dark } = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "Km">>();
  const [mode, setMode] = useState<Range>("7d");
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [data, setData] = useState<KmReport | null>(null);
  const [sel, setSel] = useState(0);
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
          setSel(Math.max(0, r.days.length - 1));
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

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40, paddingHorizontal: 14, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <GlassButton t={t} icon={ChevronLeft} onPress={() => nav.goBack()} />
          <Text style={{ fontSize: 21, color: t.text, fontFamily: font.display.extrabold }}>{tr("km.title")}</Text>
        </View>

        {/* intervalle */}
        <PeriodSelector
          t={t}
          mode={mode}
          customFrom={customFrom}
          customTo={customTo}
          onChange={(m, from, to) => {
            setMode(m);
            setCustomFrom(from);
            setCustomTo(to);
          }}
        />

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
              <BarChart t={t} days={data.days} selected={sel} onSelect={setSel} />
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
    </View>
  );
}
