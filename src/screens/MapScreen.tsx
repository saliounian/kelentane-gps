import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import MapView, { PROVIDER_DEFAULT, type MapType, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Clock, Crosshair, Info, Layers, Navigation, Route, Search } from "lucide-react-native";
import { ACCENT, hexA, OFFLINE, ONLINE, PARKED } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useVehicles } from "../data/useVehicles";
import { iconForVehicle } from "../icons/vehicleIcons";
import { ActionBtn, GlassButton, KMonogram, Metric, StatusPill } from "../ui";
import { VehicleMarker } from "./map/VehicleMarker";
import type { RootStackParamList } from "../navigation/types";
import type { VehicleVM } from "../types/vehicle";

const DAKAR: Region = { latitude: 14.6928, longitude: -17.4467, latitudeDelta: 0.09, longitudeDelta: 0.09 };

function fmtDT(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function MapScreen() {
  const { t, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { vehicles, error } = useVehicles();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [mapType, setMapType] = useState<MapType>("standard");
  const [showCard, setShowCard] = useState(true);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (activeId === null && vehicles.length) setActiveId(vehicles[0].id);
  }, [vehicles, activeId]);

  const active = useMemo<VehicleVM | null>(
    () => vehicles.find((v) => v.id === activeId) ?? null,
    [vehicles, activeId],
  );
  const activeCount = vehicles.filter((v) => v.status !== "offline").length;

  const recenter = (v: VehicleVM | null) => {
    if (!v?.lat || !v?.lng) return;
    mapRef.current?.animateToRegion(
      { latitude: Number(v.lat), longitude: Number(v.lng), latitudeDelta: 0.02, longitudeDelta: 0.02 },
      350,
    );
  };

  const select = (v: VehicleVM) => {
    setActiveId(v.id);
    setShowCard(true);
    recenter(v);
  };

  const ActiveIcon = active ? iconForVehicle(active) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={DAKAR}
        mapType={mapType}
        showsMyLocationButton={false}
      >
        {vehicles.map((v) => (
          <VehicleMarker key={v.id} v={v} active={v.id === activeId} onPress={() => select(v)} />
        ))}
      </MapView>

      {/* barre de marque */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 14,
          right: 14,
          borderRadius: 20,
          padding: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: t.glass,
          borderWidth: 1,
          borderColor: t.border,
        }}
      >
        <KMonogram />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, color: t.text, fontFamily: font.display.extrabold }}>kelentane</Text>
          <Text style={{ fontSize: 11, color: t.sub, fontFamily: font.body.regular }}>
            {vehicles.length} véhicules · {activeCount} actifs
          </Text>
        </View>
        <GlassButton t={t} icon={Search} />
      </View>

      {/* contrôles carte */}
      <View style={{ position: "absolute", right: 14, top: insets.top + 78, gap: 8 }}>
        <GlassButton
          t={t}
          icon={Layers}
          size={38}
          color={mapType === "satellite" ? ACCENT : t.text}
          onPress={() => setMapType((m) => (m === "standard" ? "satellite" : "standard"))}
        />
        <GlassButton t={t} icon={Crosshair} size={38} color={ACCENT} onPress={() => recenter(active)} />
      </View>

      {/* bandeau erreur */}
      {error ? (
        <View
          style={{
            position: "absolute",
            top: insets.top + 78,
            left: 14,
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: hexA(PARKED, 0.16),
            maxWidth: 220,
          }}
        >
          <Text style={{ fontSize: 12, color: PARKED, fontFamily: font.body.semibold }}>{error}</Text>
        </View>
      ) : null}

      {/* carte véhicule sélectionné */}
      {active && showCard ? (
        <View
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 92,
            borderRadius: 22,
            padding: 12,
            backgroundColor: t.glassSolid,
            borderWidth: 1,
            borderColor: t.border,
            shadowColor: "#000",
            shadowOpacity: dark ? 0.5 : 0.2,
            shadowRadius: 40,
            shadowOffset: { width: 0, height: 20 },
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: hexA(active.color, 0.16),
              }}
            >
              {ActiveIcon ? <ActiveIcon size={20} color={active.color} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 16, color: t.text, fontFamily: font.body.bold }}>{active.name}</Text>
                <StatusPill status={active.status} color={active.color} />
              </View>
              <Text numberOfLines={1} style={{ fontSize: 12, color: t.sub, marginTop: 2, fontFamily: font.body.regular }}>
                {active.addr ?? "Adresse indisponible"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            <Metric t={t} label="Vitesse" value={`${active.speed}`} unit="km/h" />
            <Metric t={t} label="Batterie" value={active.battery != null ? `${active.battery}` : "—"} unit="%" />
            <Metric
              t={t}
              label="Connexion"
              value={active.status === "offline" ? "Hors ligne" : "En ligne"}
              valueColor={active.status === "offline" ? OFFLINE : ONLINE}
              small
            />
            <Metric
              t={t}
              label="État"
              value={active.speed > 0 ? "En route" : "Arrêté"}
              valueColor={active.speed > 0 ? ACCENT : PARKED}
              small
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
            <Clock size={11} color={t.sub} />
            <Text style={{ fontSize: 11, color: t.sub, fontFamily: font.mono.regular }}>{fmtDT(active.lastSeen)}</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <ActionBtn
              t={t}
              icon={Navigation}
              label="Suivi"
              primary
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${active.lat},${active.lng}&travelmode=driving`,
                )
              }
            />
            <ActionBtn t={t} icon={Route} label="Trajectoire" onPress={() => {}} />
            <ActionBtn t={t} icon={Info} label="Plus" onPress={() => nav.navigate("Detail", { vehicleId: active.id })} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
