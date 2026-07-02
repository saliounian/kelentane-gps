import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Battery, Plus, Search } from "lucide-react-native";
import { ACCENT, hexA, LIME_ON } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useVehicles } from "../data/useVehicles";
import { iconForVehicle } from "../icons/vehicleIcons";
import { Glass, StatusDot } from "../ui";
import type { RootStackParamList } from "../navigation/types";

export function ListScreen() {
  const { t, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { vehicles, loading, error } = useVehicles();
  const [q, setQ] = useState("");

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
              Véhicules
            </Text>
            <Text style={{ fontSize: 13, color: t.sub, fontFamily: font.body.regular }}>Flotte Kelentane · Dakar</Text>
          </View>
          <Pressable
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
            placeholder="Rechercher un véhicule"
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
            {loading ? "Chargement…" : "Aucun véhicule"}
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((v) => {
              const Icon = iconForVehicle(v);
              return (
                <Pressable key={v.id} onPress={() => nav.navigate("Detail", { vehicleId: v.id })}>
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
                        {v.speed}
                        <Text style={{ fontSize: 10, color: t.sub }}> km/h</Text>
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
    </View>
  );
}
