import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertTriangle, Battery, Hash, KeyRound, Plus, Search, Trash2 } from "lucide-react-native";
import { ACCENT, ALERT, hexA, LIME_ON } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { usePrefs } from "../state/prefs";
import { convSpeed, speedUnit } from "../i18n/units";
import { useVehicles } from "../data/useVehicles";
import { deleteVehicle, enrollVehicle } from "../data/api";
import { iconForVehicle } from "../icons/vehicleIcons";
import { BottomSheet, Field, Glass, StatusDot } from "../ui";
import type { RootStackParamList } from "../navigation/types";
import type { VehicleVM } from "../types/vehicle";

export function ListScreen() {
  const { t, dark } = useTheme();
  const { t: tr } = useTranslation();
  const { units } = usePrefs();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { vehicles, loading, error, refresh } = useVehicles();
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [imei, setImei] = useState("");
  const [ename, setEname] = useState("");
  const [busy, setBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<VehicleVM | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delPwd, setDelPwd] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);

  const openDelete = (v: VehicleVM) => { setDelPwd(""); setDelErr(null); setDelTarget(v); };

  const enroll = async () => {
    if (busy) return;
    setBusy(true);
    setAddErr(null);
    try {
      await enrollVehicle(imei, ename || undefined);
      setImei("");
      setEname("");
      setAddOpen(false);
      refresh();
    } catch (e) {
      setAddErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!delTarget || delBusy || !delPwd.trim()) return;
    setDelBusy(true);
    setDelErr(null);
    try {
      await deleteVehicle(delTarget.id, delPwd);
      setDelTarget(null);
      setDelPwd("");
      refresh();
    } catch (e) {
      setDelErr((e as Error).message); // 401 = mot de passe incorrect, garde le sheet
    } finally {
      setDelBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vehicles;
    return vehicles.filter((v) =>
      [v.name, v.plate, v.addr].some((f) => (f ?? "").toLowerCase().includes(s)),
    );
  }, [vehicles, q]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 110, paddingHorizontal: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, color: t.text, fontFamily: font.display.extrabold, letterSpacing: -0.5 }}>
              {tr("list.title")}
            </Text>
            <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.regular }}>{tr("list.subtitle")}</Text>
          </View>
          <Pressable
            onPress={() => { setAddErr(null); setAddOpen(true); }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: ACCENT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={22} color={LIME_ON} />
          </Pressable>
        </View>

        {/* recherche */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 44,
            marginBottom: 12,
            backgroundColor: t.glass,
            borderWidth: 1,
            borderColor: t.border,
          }}
        >
          <Search size={16} color={t.sub} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={tr("list.search")}
            placeholderTextColor={t.sub}
            style={{ flex: 1, color: t.text, fontSize: 14, fontFamily: font.body.regular }}
          />
        </View>

        {error ? (
          <Text style={{ color: t.sub, fontSize: 13, textAlign: "center", marginTop: 20, fontFamily: font.body.regular }}>
            {error}
          </Text>
        ) : filtered.length === 0 ? (
          <Text style={{ color: t.sub, fontSize: 13, textAlign: "center", marginTop: 20, fontFamily: font.body.regular }}>
            {loading ? tr("common.loading") : tr("list.empty")}
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((v) => {
              const Icon = iconForVehicle(v);
              return (
                <Pressable key={v.id} onPress={() => nav.navigate("Detail", { vehicleId: v.id })} onLongPress={() => openDelete(v)} delayLongPress={500}>
                  <Glass t={t} dark={dark} radius={18} style={{ padding: 13, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 13,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: hexA(v.color, 0.16),
                      }}
                    >
                      <Icon size={22} color={v.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 15, color: t.text, fontFamily: font.body.bold }}>{v.name}</Text>
                        <StatusDot status={v.status} color={v.color} />
                      </View>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: t.sub, marginTop: 1, fontFamily: font.body.regular }}>
                        {v.addr ?? "—"}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 15, color: t.text, fontFamily: font.mono.semibold }}>
                        {convSpeed(v.speed, units)}
                        <Text style={{ fontSize: 10, color: t.sub }}> {speedUnit(units, tr)}</Text>
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Battery size={11} color={t.sub} />
                        <Text style={{ fontSize: 11, color: t.sub, fontFamily: font.body.regular }}>
                          {v.battery != null ? `${v.battery}%` : "—"}
                        </Text>
                      </View>
                    </View>
                  </Glass>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Ajouter un dispositif */}
      <BottomSheet t={t} visible={addOpen} onClose={() => setAddOpen(false)}>
        <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 2 }}>{tr("list.add")}</Text>
        <Text style={{ fontSize: 12, color: t.sub, marginBottom: 14, fontFamily: font.body.regular }}>{tr("list.addDesc")}</Text>
        <Field t={t} label={tr("list.imei")} icon={Hash} placeholder="356 789 123 456 789" mono keyboardType="number-pad" value={imei} onChangeText={setImei} />
        <Field t={t} label={tr("list.nameOpt")} icon={Search} placeholder="Peugeot Expert" value={ename} onChangeText={setEname} />
        {addErr ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={14} color={ALERT} />
            <Text style={{ flex: 1, fontSize: 12.5, color: ALERT, fontFamily: font.body.medium }}>{addErr}</Text>
          </View>
        ) : null}
        <Pressable onPress={enroll} disabled={!imei.trim() || busy} style={{ padding: 14, borderRadius: 14, alignItems: "center", backgroundColor: imei.trim() ? ACCENT : hexA(t.text, 0.12) }}>
          <Text style={{ fontSize: 15, color: imei.trim() ? LIME_ON : t.sub, fontFamily: font.body.bold }}>{busy ? tr("list.enrolling") : tr("list.enroll")}</Text>
        </Pressable>
      </BottomSheet>

      {/* Supprimer un véhicule (appui long) — protégé par mot de passe compte */}
      <BottomSheet t={t} visible={delTarget !== null} onClose={() => setDelTarget(null)}>
        <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, marginBottom: 4 }}>{tr("list.deleteTitle")}</Text>
        <Text style={{ fontSize: 13, color: t.sub, marginBottom: 14, fontFamily: font.body.regular }}>
          {delTarget?.name} · {tr("list.deleteDesc")}
        </Text>
        <Field t={t} label={tr("pwd.accountPwd")} icon={KeyRound} placeholder="••••••" secure value={delPwd} onChangeText={(v) => { setDelPwd(v); setDelErr(null); }} />
        {delErr ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={14} color={ALERT} />
            <Text style={{ flex: 1, fontSize: 12.5, color: ALERT, fontFamily: font.body.medium }}>{delErr}</Text>
          </View>
        ) : null}
        <Pressable onPress={confirmDelete} disabled={delBusy || !delPwd.trim()} style={{ padding: 14, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: delPwd.trim() ? ALERT : hexA(t.text, 0.12) }}>
          <Trash2 size={17} color={delPwd.trim() ? "#fff" : t.sub} />
          <Text style={{ fontSize: 15, color: delPwd.trim() ? "#fff" : t.sub, fontFamily: font.body.bold }}>{delBusy ? "…" : tr("list.delete")}</Text>
        </Pressable>
        <Pressable onPress={() => setDelTarget(null)} style={{ padding: 12, alignItems: "center", marginTop: 8 }}>
          <Text style={{ fontSize: 14, color: t.sub, fontFamily: font.body.semibold }}>{tr("list.cancel")}</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}
