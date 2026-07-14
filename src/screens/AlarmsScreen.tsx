import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Bell, MapPin, Settings } from "lucide-react-native";
import { ACCENT, ALERT, hexA, LIME_ON, OFFLINE, ONLINE, PARKED, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { fetchAlarmEvents, fetchAnomalies, fetchPrefs, patchPrefs } from "../data/alarms";
import { ALARM_TYPE_BY_ID } from "../data/alarmTypes";
import { AlarmSettingsSheet, GlassButton, Toggle } from "../ui";
import type { RootStackParamList } from "../navigation/types";
import type { AlarmEventVM, DeviceHealthVM, HealthStatus, NotificationPrefs } from "../types/alarm";

const HEALTH_DOT: Record<HealthStatus, string> = { ok: ONLINE, check: PARKED, problem: ALERT };
const HEALTH_KEY: Record<HealthStatus, string> = { ok: "alarms.ok", check: "alarms.check", problem: "alarms.problem" };

export function AlarmsScreen() {
  const { t } = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [events, setEvents] = useState<AlarmEventVM[]>([]);
  const [health, setHealth] = useState<DeviceHealthVM[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs>({ armed: true, types: {} });
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"alarmes" | "anomalies">("anomalies");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ev, he, pr] = await Promise.all([fetchAlarmEvents(), fetchAnomalies(), fetchPrefs()]);
        if (!alive) return;
        setEvents(ev);
        setHealth(he);
        setPrefs(pr);
        setError(null);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const anomCount = useMemo(() => health.filter((d) => d.status !== "ok").length, [health]);
  // défaut intelligent : Anomalies si présentes
  useEffect(() => {
    if (anomCount === 0) setTab("alarmes");
  }, [anomCount]);

  const setArmed = async (armed: boolean) => {
    setPrefs((p) => ({ ...p, armed }));
    try {
      const r = await patchPrefs({ armed });
      setPrefs(r);
    } catch {
      /* ignore */
    }
  };
  const toggleType = async (id: string, value: boolean) => {
    setPrefs((p) => ({ ...p, types: { ...p.types, [id]: value } }));
    try {
      await patchPrefs({ types: { [id]: value } });
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 110, paddingHorizontal: 14 }}>
        {/* header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, color: t.text, fontFamily: font.display.extrabold, letterSpacing: -0.5 }}>{tr("alarms.title")}</Text>
            <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.regular }}>
              {tab === "anomalies"
                ? anomCount > 0
                  ? tr("alarms.toCorrect", { count: anomCount })
                  : tr("alarms.allGood")
                : tr("alarms.recentEvents", { count: events.length })}
            </Text>
          </View>
          <GlassButton t={t} icon={Settings} size={38} onPress={() => setSettings(true)} />
        </View>

        {/* onglets */}
        <View style={{ flexDirection: "row", gap: 4, borderRadius: 12, padding: 3, marginBottom: 12, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
          {(["alarmes", "anomalies"] as const).map((id) => {
            const on = tab === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: on ? ACCENT : "transparent" }}
              >
                <Text style={{ fontSize: 13, color: on ? LIME_ON : t.sub, fontFamily: on ? font.body.bold : font.body.medium }}>
                  {id === "alarmes" ? tr("alarms.tabAlarms") : tr("alarms.tabAnomalies")}
                </Text>
                {id === "anomalies" && anomCount > 0 ? (
                  <View style={{ minWidth: 16, height: 16, borderRadius: 999, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#fff" : ALERT }}>
                    <Text style={{ fontSize: 10, color: on ? ALERT : "#fff", fontFamily: font.body.bold }}>{anomCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* interrupteur maître */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, padding: 13, marginBottom: 14, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: hexA(prefs.armed ? ONLINE : OFFLINE, 0.16) }}>
            <Bell size={19} color={prefs.armed ? ONLINE : OFFLINE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.bold }}>
              {prefs.armed ? tr("alarms.armed") : tr("alarms.disarmed")}
            </Text>
            <Text style={{ fontSize: 11.5, color: t.sub, fontFamily: font.body.regular }}>
              {prefs.armed ? tr("alarms.armedDesc") : tr("alarms.disarmedDesc")}
            </Text>
          </View>
          <Toggle t={t} on={prefs.armed} set={setArmed} large />
        </View>

        {error ? (
          <Text style={{ color: t.sub, fontSize: 13, textAlign: "center", marginTop: 20, fontFamily: font.body.regular }}>{error}</Text>
        ) : tab === "anomalies" ? (
          <View style={{ gap: 10 }}>
            {health.map((d) => {
              const dot = HEALTH_DOT[d.status];
              const label = tr(HEALTH_KEY[d.status]);
              const okSub = tr("alarms.okSub");
              const isOpen = open[d.vehicle];
              const summary = d.status === "ok" ? okSub : ALARM_TYPE_BY_ID[d.anomalies[0]?.type]?.label ?? label;
              return (
                <View key={d.vehicle} style={{ borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: d.status === "ok" ? t.border : hexA(dot, 0.4), backgroundColor: d.status === "ok" ? t.glass : hexA(dot, 0.07) }}>
                  <Pressable
                    onPress={() => d.status !== "ok" && setOpen((o) => ({ ...o, [d.vehicle]: !o[d.vehicle] }))}
                    style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: 13 }}
                  >
                    <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: dot }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, color: t.text, fontFamily: font.body.bold }}>{d.vehicle}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: dot, marginTop: 1, fontFamily: font.body.regular }}>
                        {label}
                        {d.status !== "ok" && summary ? ` · ${summary}` : ""}
                        {d.status === "ok" ? ` · ${okSub}` : ""}
                      </Text>
                    </View>
                    {d.status !== "ok" ? <Text style={{ color: t.sub, fontSize: 16 }}>{isOpen ? "⌄" : "›"}</Text> : null}
                  </Pressable>
                  {isOpen && d.anomalies.length > 0 ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: t.line, paddingHorizontal: 13, paddingBottom: 13 }}>
                      {d.anomalies.map((an, i) => {
                        const ty = ALARM_TYPE_BY_ID[an.type];
                        const Icon = ty?.icon ?? Bell;
                        const col = ty?.color ?? ALERT;
                        return (
                          <View key={i} style={{ flexDirection: "row", gap: 10, paddingTop: 12 }}>
                            <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: hexA(col, 0.18) }}>
                              <Icon size={15} color={col} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13.5, color: t.text, fontFamily: font.body.bold }}>{ty?.label ?? an.type}</Text>
                              <Text style={{ fontSize: 12, color: t.sub, marginTop: 2, lineHeight: 17, fontFamily: font.body.regular }}>{an.cause}</Text>
                              <View style={{ alignSelf: "flex-start", marginTop: 8, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11, backgroundColor: hexA(ACCENT, 0.14) }}>
                                <Text style={{ fontSize: 12, color: t.accentMuted, fontFamily: font.body.bold }}>{an.action} →</Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
            {health.length === 0 ? (
              <Text style={{ color: t.sub, fontSize: 13, textAlign: "center", marginTop: 20, fontFamily: font.body.regular }}>{tr("alarms.noHealth")}</Text>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {events.map((e, i) => {
              const ty = ALARM_TYPE_BY_ID[e.type];
              const Icon = ty?.icon ?? Bell;
              const col = ty?.color ?? PARKED;
              const off = prefs.types[e.type] === false || !prefs.armed;
              return (
                <Pressable
                  key={i}
                  onPress={() => nav.navigate("AlarmLocation", { alarm: e })}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 13, opacity: off ? 0.45 : 1, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: hexA(col, 0.16) }}>
                    <Icon size={20} color={col} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.bold }}>{ty?.label ?? e.type}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>{e.vehicle} · {e.detail}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Text style={{ fontSize: 11, color: t.sub, fontFamily: font.body.regular }}>{e.time}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <MapPin size={11} color={t.accentMuted} />
                      <Text style={{ fontSize: 10.5, color: t.accentMuted, fontFamily: font.body.bold }}>{tr("alarms.see")}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {events.length === 0 ? (
              <Text style={{ color: t.sub, fontSize: 13, textAlign: "center", marginTop: 20, fontFamily: font.body.regular }}>{tr("alarms.noEvents")}</Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      <AlarmSettingsSheet t={t} visible={settings} enabled={prefs.types} onToggle={toggleType} onClose={() => setSettings(false)} />
    </View>
  );
}
