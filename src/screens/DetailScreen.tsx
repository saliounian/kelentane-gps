import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { ChevronLeft, Clock, MapPin, Power, Signal, Wifi, WifiOff } from "lucide-react-native";
import { freshColor, ONLINE, OFFLINE } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useVehicles } from "../data/useVehicles";
import { Glass, GlassButton, Metric, Row, StatusPill } from "../ui";
import type { RootStackParamList } from "../navigation/types";

function relAgo(iso: string | null): string {
  if (!iso) return "—";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}
function fmtDT(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Fiche détail (étape 3 : lecture sur données réelles).
 * Commandes réelles + édition persistée + détails dispositif = étape 4/5.
 */
export function DetailScreen() {
  const { t, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "Detail">>();
  const { vehicles } = useVehicles();
  const v = vehicles.find((x) => x.id === params.vehicleId);

  if (!v) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 12, paddingHorizontal: 14 }}>
        <GlassButton t={t} icon={ChevronLeft} onPress={() => nav.goBack()} />
        <Text style={{ color: t.sub, marginTop: 20, fontFamily: font.body.regular }}>Véhicule introuvable.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 110, paddingHorizontal: 14, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <GlassButton t={t} icon={ChevronLeft} onPress={() => nav.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 21, color: t.text, fontFamily: font.display.extrabold, letterSpacing: -0.4 }}>
              {v.name}
            </Text>
            <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.mono.regular }}>{v.plate ?? v.imei}</Text>
          </View>
          <StatusPill status={v.status} color={v.color} />
        </View>

        <Glass t={t} dark={dark} style={{ padding: 12, flexDirection: "row", gap: 8 }}>
          <Metric t={t} label="Vitesse" value={`${v.speed}`} unit="km/h" />
          <Metric t={t} label="Batterie" value={v.battery != null ? `${v.battery}` : "—"} unit="%" />
          <Metric t={t} label="Tension" value={v.voltage != null ? `${v.voltage}` : "—"} unit="V" />
        </Glass>

        <Glass t={t} dark={dark} style={{ padding: 4 }}>
          <Row t={t} icon={MapPin} label="Adresse" value={v.addr ?? "—"} />
          <Row t={t} icon={Signal} label="Positionnement" value={v.signal} />
          <Row t={t} icon={Power} label="Contact (ACC)" value={v.acc == null ? "—" : v.acc ? "Marche" : "Arrêt"} valueColor={v.acc ? ONLINE : OFFLINE} />
          <Row t={t} icon={Clock} label="Dernière position" value={fmtDT(v.lastSeen)} mono />
          <Row
            t={t}
            icon={v.status === "offline" ? WifiOff : Wifi}
            label="Mise à jour"
            value={relAgo(v.lastSeen)}
            valueColor={v.lastSeen ? freshColor(new Date(v.lastSeen)) : OFFLINE}
            last
          />
        </Glass>

        <Text style={{ fontSize: 12, color: t.sub, textAlign: "center", fontFamily: font.body.regular }}>
          Commandes & détails dispositif — étape 4/5
        </Text>
      </ScrollView>
    </View>
  );
}
