import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { Check, ChevronLeft } from "lucide-react-native";
import { hexA } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useVehicles } from "../data/useVehicles";
import { patchVehicle } from "../data/api";
import { useIconOverrides } from "../state/iconOverrides";
import { VEH_ICON_LABELS, VEH_ICON_LIST, VEH_ICONS } from "../icons/vehicleIcons";
import { GlassButton } from "../ui";
import type { RootStackParamList } from "../navigation/types";

/** Sélecteur d'icône plein écran (PAGE, pas un pop-up — handoff §8). */
export function IconPickerScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "IconPicker">>();
  const { vehicles } = useVehicles();
  const { overrides, setIcon } = useIconOverrides();
  const v = vehicles.find((x) => x.id === params.vehicleId);
  const color = v?.color ?? t.accent;
  const current = overrides[params.vehicleId] ?? v?.iconKey ?? undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 14, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <GlassButton t={t} icon={ChevronLeft} onPress={() => nav.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, color: t.text, fontFamily: font.display.extrabold }}>Icône du véhicule</Text>
            <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>
              Choisis l'icône affichée sur la carte.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {VEH_ICON_LIST.map((k) => {
            const Icon = VEH_ICONS[k];
            const on = k === current;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  setIcon(params.vehicleId, k); // feedback immédiat
                  void patchVehicle(params.vehicleId, { iconKey: k }).catch(() => {}); // persistance base app
                  nav.goBack();
                }}
                style={{ width: "31%", alignItems: "center", gap: 6 }}
              >
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 1,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? hexA(color, 0.16) : t.glass,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? color : t.border,
                  }}
                >
                  <Icon size={26} color={on ? color : t.text} />
                  {on ? (
                    <View style={{ position: "absolute", top: 6, right: 6 }}>
                      <Check size={15} color={color} />
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 11, color: on ? t.text : t.sub, fontFamily: font.body.medium }}>
                  {VEH_ICON_LABELS[k]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
