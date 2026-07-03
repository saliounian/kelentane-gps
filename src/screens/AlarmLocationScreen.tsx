import { Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Bell, ChevronLeft, MapPin, X } from "lucide-react-native";
import { ALERT, hexA } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { ALARM_TYPE_BY_ID } from "../data/alarmTypes";
import { Glass, GlassButton } from "../ui";
import type { RootStackParamList } from "../navigation/types";

export function AlarmLocationScreen() {
  const { t, dark } = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "AlarmLocation">>();
  const a = params.alarm;
  const lat = a.lat ? Number(a.lat) : 14.6928;
  const lng = a.lng ? Number(a.lng) : -17.4467;
  const region: Region = { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
  const ty = ALARM_TYPE_BY_ID[a.type];
  const Icon = ty?.icon ?? Bell;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: insets.top + 8, paddingHorizontal: 14, paddingBottom: 8 }}>
        <GlassButton t={t} icon={ChevronLeft} size={38} onPress={() => nav.goBack()} />
        <Text style={{ fontSize: 17, color: t.text, fontFamily: font.display.extrabold }}>{tr("alarmLoc.title")}</Text>
      </View>

      {/* bandeau adresse */}
      <View style={{ marginHorizontal: 14, marginBottom: 10 }}>
        <Glass t={t} dark={dark} radius={14} style={{ flexDirection: "row", gap: 8, padding: 12 }}>
          <MapPin size={15} color={ALERT} />
          <Text style={{ flex: 1, fontSize: 12.5, color: t.text, lineHeight: 18, fontFamily: font.body.regular }}>{a.addr ?? tr("common.noAddress")}</Text>
        </Glass>
      </View>

      {/* carte */}
      <View style={{ flex: 1, marginHorizontal: 14, marginBottom: 16, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: t.border }}>
        <MapView provider={PROVIDER_DEFAULT} style={{ flex: 1 }} initialRegion={region}>
          <Marker coordinate={{ latitude: lat, longitude: lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: ALERT, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
              <Icon size={20} color="#fff" />
            </View>
          </Marker>
        </MapView>

        {/* popup blanc */}
        <View style={{ position: "absolute", top: 14, left: 20, right: 20, borderRadius: 14, padding: 12, backgroundColor: dark ? "#1c1d26" : "#fff", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}>
          <View style={{ position: "absolute", top: 8, right: 8 }}>
            <X size={15} color={dark ? "#aaa" : "#888"} onPress={() => nav.goBack()} />
          </View>
          <Text style={{ fontSize: 12.5, color: dark ? "#fff" : "#111", lineHeight: 20, fontFamily: font.body.regular }}>
            <Text style={{ fontFamily: font.body.bold }}>{tr("alarmLoc.name")} : </Text>{a.vehicle}{"\n"}
            <Text style={{ fontFamily: font.body.bold }}>{tr("alarmLoc.status")} : </Text>{a.statusText} · {a.speed} km/h{"\n"}
            <Text style={{ fontFamily: font.body.bold }}>{tr("alarmLoc.signal")} : </Text>{a.dt}{"\n"}
            <Text style={{ fontFamily: font.body.bold }}>{tr("alarmLoc.time")} : </Text>{a.dt}
          </Text>
        </View>

        {/* coords */}
        <View style={{ position: "absolute", bottom: 10, left: 10, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 9, backgroundColor: hexA(dark ? "#000000" : "#ffffff", 0.7) }}>
          <Text style={{ fontSize: 11, color: t.text, fontFamily: font.mono.regular }}>{a.lat}, {a.lng}</Text>
        </View>
      </View>
    </View>
  );
}
