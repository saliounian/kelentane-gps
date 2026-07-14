import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Polyline, PROVIDER_DEFAULT, type MapType, type Region } from "react-native-maps";
import ClusteredMapView from "react-native-map-clustering";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock, Crosshair, Grid2x2Plus, Layers, PersonStanding, Power, Radar, Route, Search } from "lucide-react-native";
import { ACCENT, ALERT, hexA, LIME_ON, OFFLINE, ONLINE, PARKED } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { usePrefs } from "../state/prefs";
import { convSpeed, speedUnit } from "../i18n/units";
import { useVehicles } from "../data/useVehicles";
import { iconForVehicle } from "../icons/vehicleIcons";
import { ActionBtn, GlassButton, KMonogram, Metric, StatusPill } from "../ui";
import { VehicleMarker } from "./map/VehicleMarker";
import type { RootStackParamList } from "../navigation/types";
import type { VehicleVM } from "../types/vehicle";

const DAKAR: Region = { latitude: 14.6928, longitude: -17.4467, latitudeDelta: 0.09, longitudeDelta: 0.09 };
const LAST_VEHICLE_KEY = "map.lastVehicle";
const STALE_MS = 6 * 60 * 60 * 1000; // §1 : donnée jugée obsolète au-delà de 6 h sans MAJ

/** Donnée périmée : dernière position trop ancienne (à ne pas confondre avec « récent »). */
function isStale(lastSeen: string | null): boolean {
  if (!lastSeen) return true;
  return Date.now() - new Date(lastSeen).getTime() > STALE_MS;
}

function fmtDT(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function MapScreen() {
  const { t, dark } = useTheme();
  const { t: tr } = useTranslation();
  const { units } = usePrefs();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const focused = useIsFocused();
  const [locGranted, setLocGranted] = useState(false);
  const { vehicles, error } = useVehicles();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [mapType, setMapType] = useState<MapType>("standard");
  const [showCard, setShowCard] = useState(true);
  const [restored, setRestored] = useState(false);
  const [traceOn, setTraceOn] = useState(false); // §3 : tracé temps réel du véhicule suivi
  const [trace, setTrace] = useState<{ latitude: number; longitude: number }[]>([]);
  const traceRef = useRef<{ latitude: number; longitude: number; t: number }[]>([]);
  const mapRef = useRef<MapView>(null);

  // §1 : restaurer le DERNIER véhicule consulté (popup unique par défaut).
  useEffect(() => {
    AsyncStorage.getItem(LAST_VEHICLE_KEY).then((v) => {
      if (v) setActiveId(Number(v));
      setRestored(true);
    });
  }, []);

  // Défaut / garde : si aucun véhicule actif valide → premier de la flotte.
  useEffect(() => {
    if (!restored || !vehicles.length) return;
    setActiveId((cur) => (cur != null && vehicles.some((x) => x.id === cur) ? cur : vehicles[0].id));
  }, [restored, vehicles]);

  const active = useMemo<VehicleVM | null>(
    () => vehicles.find((v) => v.id === activeId) ?? null,
    [vehicles, activeId],
  );
  const activeCount = vehicles.filter((v) => v.status !== "offline").length;

  // §3 : fenêtre glissante 2 h du véhicule suivi. En mémoire seule — purgée au
  // changement de véhicule, à l'arrêt du suivi, et à la sortie/déconnexion (unmount).
  useEffect(() => {
    traceRef.current = [];
    setTrace([]);
  }, [active?.id, traceOn]);

  useEffect(() => {
    if (!traceOn || !active?.lat || !active?.lng) return;
    const pt = {
      latitude: Number(active.lat),
      longitude: Number(active.lng),
      t: active.lastSeen ? new Date(active.lastSeen).getTime() : Date.now(),
    };
    const arr = traceRef.current;
    const last = arr[arr.length - 1];
    if (last && last.latitude === pt.latitude && last.longitude === pt.longitude) return; // pas bougé
    const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 h
    const next = [...arr, pt].filter((p) => p.t >= cutoff);
    traceRef.current = next;
    setTrace(next.map((p) => ({ latitude: p.latitude, longitude: p.longitude })));
  }, [active?.lat, active?.lng, active?.lastSeen, traceOn]);

  // §4 : position utilisateur UNIQUEMENT écran carte au premier plan (foreground).
  // On demande la permission à l'ouverture ; le point bleu natif (showsUserLocation)
  // n'est actif que tant que l'écran est focus → aucun suivi en arrière-plan.
  useEffect(() => {
    if (!focused) return;
    let alive = true;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (alive) setLocGranted(status === "granted");
    });
    return () => {
      alive = false;
    };
  }, [focused]);

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
    void AsyncStorage.setItem(LAST_VEHICLE_KEY, String(v.id)); // §1 : mémorise le dernier consulté
  };

  // Street View réel de Google, centré sur la position du véhicule sélectionné.
  // Pas d'intégration Street View native fiable côté Expo/react-native-maps → on
  // ouvre le panorama via l'URL officielle Google Maps (app native ou navigateur).
  const openStreetView = (v: VehicleVM | null) => {
    if (!v?.lat || !v?.lng) return;
    Linking.openURL(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${v.lat},${v.lng}`);
  };

  const ActiveIcon = active ? iconForVehicle(active) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ClusteredMapView
        mapRef={(r) => {
          mapRef.current = r as unknown as MapView;
        }}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={DAKAR}
        mapType={mapType}
        showsMyLocationButton={false}
        showsUserLocation={focused && locGranted}
        clusteringEnabled
        minPoints={2}
        radius={48}
        clusterColor={ACCENT}
        clusterTextColor={LIME_ON}
      >
        {traceOn && trace.length > 1 ? <Polyline coordinates={trace} strokeColor={ACCENT} strokeWidth={4} /> : null}
        {/* §2 : chaque marqueur expose `coordinate` (le clustering le lit) ; véhicules
            sans position exclus. La position exacte est préservée au dé-clustering. */}
        {vehicles
          .filter((v) => v.lat && v.lng)
          .map((v) => (
            <VehicleMarker
              key={v.id}
              v={v}
              coordinate={{ latitude: Number(v.lat), longitude: Number(v.lng) }}
              active={v.id === activeId}
              onPress={() => select(v)}
            />
          ))}
      </ClusteredMapView>

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
            {tr("map.summary", { count: vehicles.length, active: activeCount })}
          </Text>
        </View>
        <GlassButton t={t} icon={Search} onPress={() => nav.navigate("Tabs", { screen: "list" })} />
      </View>

      {/* contrôles carte */}
      <View style={{ position: "absolute", right: 14, top: insets.top + 78, gap: 8 }}>
        <GlassButton
          t={t}
          icon={Layers}
          size={38}
          color={mapType === "satellite" ? t.accentMuted : t.text}
          onPress={() => setMapType((m) => (m === "standard" ? "satellite" : "standard"))}
        />
        <GlassButton t={t} icon={Crosshair} size={38} color={t.accentMuted} onPress={() => recenter(active)} />
        <GlassButton t={t} icon={PersonStanding} size={38} color={t.text} onPress={() => openStreetView(active)} />
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={{ fontSize: 16, color: t.text, fontFamily: font.body.bold }}>{active.name}</Text>
                <StatusPill status={active.status} color={active.color} />
                {isStale(active.lastSeen) ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 999, backgroundColor: hexA(ALERT, 0.15) }}>
                    <AlertTriangle size={10} color={ALERT} />
                    <Text style={{ fontSize: 9.5, color: ALERT, fontFamily: font.body.bold }}>{tr("map.stale")}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={{ fontSize: 12, color: t.sub, marginTop: 2, fontFamily: font.body.regular }}>
                {active.addr ?? tr("common.noAddress")}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            <Metric t={t} label={tr("common.speed")} value={`${convSpeed(active.speed, units)}`} unit={speedUnit(units, tr)} />
            <Metric t={t} label={tr("common.battery")} value={active.battery != null ? `${active.battery}` : tr("common.na")} unit={active.battery != null ? "%" : undefined} />
            <Metric
              t={t}
              label={tr("common.connection")}
              value={active.status === "offline" ? tr("common.offline") : tr("common.online")}
              valueColor={active.status === "offline" ? OFFLINE : ONLINE}
              small
            />
            <Metric
              t={t}
              label={tr("common.state")}
              value={active.speed > 0 ? tr("common.enRoute") : tr("common.stopped")}
              valueColor={active.speed > 0 ? t.accentMuted : PARKED}
              small
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
            <Clock size={11} color={t.sub} />
            <Text style={{ fontSize: 11, color: t.sub, fontFamily: font.mono.regular }}>{fmtDT(active.lastSeen)}</Text>
            {active.acc != null ? (
              <>
                <Power size={11} color={active.acc ? ONLINE : OFFLINE} style={{ marginLeft: 8 }} />
                <Text style={{ fontSize: 11, color: t.sub, fontFamily: font.body.regular }}>
                  {tr("detail.acc")} · {active.acc ? tr("common.on") : tr("common.off")}
                </Text>
              </>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {/* §8 : démarre/arrête le TRACÉ temps réel sur cette carte (ne quitte pas
                l'écran). Distinct de « Suivre l'itinéraire » du Détail (redirection). */}
            <ActionBtn
              t={t}
              icon={Radar}
              label={traceOn ? tr("map.following") : tr("map.follow")}
              primary={traceOn}
              onPress={() => setTraceOn((o) => !o)}
            />
            <ActionBtn t={t} icon={Route} label={tr("map.traj")} onPress={() => nav.navigate("Traj", { vehicleId: active.id })} />
            <ActionBtn t={t} icon={Grid2x2Plus} label={tr("map.more")} onPress={() => nav.navigate("Detail", { vehicleId: active.id })} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
