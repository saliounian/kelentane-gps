import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import MapView, { Polyline, PROVIDER_DEFAULT, type MapType, type Region } from "react-native-maps";
import ClusteredMapView from "react-native-map-clustering";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { AlertTriangle, BatteryCharging, Clock, Crosshair, Grid2x2Plus, PersonStanding, Power, Radar, Route, Search } from "lucide-react-native";
import { ACCENT, ALERT, hexA, LIME_ON, OFFLINE, ONLINE, PARKED, TRACK } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { usePrefs } from "../state/prefs";
import { convSpeed, speedUnit } from "../i18n/units";
import { useVehicles } from "../data/useVehicles";
import { relAge } from "../utils/relTime";
import { iconForVehicle } from "../icons/vehicleIcons";
import { ActionBtn, GlassButton, KMonogram, Metric, StatusPill } from "../ui";
import { VehicleMarker } from "./map/VehicleMarker";
import { MapTypeButton, toggleMapType } from "./map/MapTypeButton";
import { getLastConsulted, getLastEnrolled, setLastConsulted } from "../data/focusPrefs";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import type { VehicleVM } from "../types/vehicle";

const DAKAR: Region = { latitude: 14.6928, longitude: -17.4467, latitudeDelta: 0.09, longitudeDelta: 0.09 };
const FOCUS: Pick<Region, "latitudeDelta" | "longitudeDelta"> = { latitudeDelta: 0.02, longitudeDelta: 0.02 };
const STALE_MS = 6 * 60 * 60 * 1000; // §1 : donnée jugée obsolète au-delà de 6 h sans MAJ

/**
 * §3 — sélection initiale au montage, ordre de priorité :
 *  (a) dernier device ajouté : `createdAt` desc si l'API l'expose, sinon proxy local
 *      `lastEnrolled` (dernier enrôlement sur CET appareil) ;
 *  (b) sinon dernier consulté persisté ;
 *  (c) sinon premier de la liste.
 * Cadrage = zoom direct sur ce véhicule (jamais fitToCoordinates sur la flotte).
 */
function pickInitial(
  vehicles: VehicleVM[],
  lastEnrolledId: number | null,
  lastConsultedId: number | null,
): number | null {
  if (!vehicles.length) return null;
  const has = (id: number | null) => id != null && vehicles.some((v) => v.id === id);
  const dated = vehicles.filter((v) => v.createdAt);
  if (dated.length) {
    return dated.reduce((a, b) => (String(a.createdAt) >= String(b.createdAt) ? a : b)).id;
  }
  if (has(lastEnrolledId)) return lastEnrolledId;
  if (has(lastConsultedId)) return lastConsultedId;
  return vehicles[0].id;
}

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
  // Même objet de navigation, typé onglet : sert à effacer le param `vehicleId`
  // du deep-link (§4) sans casser le typage stack utilisé pour les push d'écrans.
  const tabNav = useNavigation<BottomTabNavigationProp<TabParamList, "map">>();
  const route = useRoute<RouteProp<TabParamList, "map">>();
  const routeVehicleId = route.params?.vehicleId ?? null;
  const focused = useIsFocused();
  const [locGranted, setLocGranted] = useState(false);
  const { vehicles, error } = useVehicles();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [mapType, setMapType] = useState<MapType>("standard");
  const [showCard, setShowCard] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [prefs, setPrefs] = useState<{ enrolled: number | null; consulted: number | null } | null>(null);
  const [traceOn, setTraceOn] = useState(false); // §6 : tracé temps réel du véhicule actif
  const [trace, setTrace] = useState<{ latitude: number; longitude: number }[]>([]);
  const [addrCache, setAddrCache] = useState<Record<number, string>>({}); // adresses reverse-geocodées par véhicule
  const traceRef = useRef<{ latitude: number; longitude: number; t: number }[]>([]);
  const mapRef = useRef<MapView>(null);
  // Liste courante lue par `selectVehicle` sans le refaire dépendre de `vehicles`
  // (handler stable → effets de sélection déterministes).
  const vehiclesRef = useRef<VehicleVM[]>(vehicles);
  vehiclesRef.current = vehicles;
  const didInitRef = useRef(false); // sélection initiale (§3) faite une seule fois
  const framedRef = useRef(false); // 1er cadrage caméra (attend carte prête)

  const active = useMemo<VehicleVM | null>(
    () => vehicles.find((v) => v.id === activeId) ?? null,
    [vehicles, activeId],
  );
  const activeCount = vehicles.filter((v) => v.status !== "offline").length;

  // Cadrage caméra : zoom direct sur un véhicule (jamais fitToCoordinates flotte).
  const frameVehicle = useCallback((v: VehicleVM | null) => {
    if (!v?.lat || !v?.lng) return;
    mapRef.current?.animateToRegion(
      { latitude: Number(v.lat), longitude: Number(v.lng), ...FOCUS },
      350,
    );
  }, []);

  // §2 : HANDLER UNIQUE de sélection. Met à jour SIMULTANÉMENT popup + tracé (via
  // l'effet clé sur `active?.id`) + centrage caméra, éliminant toute désync entre
  // le véhicule cadré et celui affiché dans la carte.
  const selectVehicle = useCallback(
    (id: number, opts: { persist?: boolean } = {}) => {
      const { persist = true } = opts;
      setActiveId(id);
      setShowCard(true);
      frameVehicle(vehiclesRef.current.find((v) => v.id === id) ?? null);
      if (persist) void setLastConsulted(id); // §3 : mémorise le dernier consulté
    },
    [frameVehicle],
  );

  // Préférences de focus persistées (proxy « dernier ajouté » + dernier consulté).
  useEffect(() => {
    Promise.all([getLastEnrolled(), getLastConsulted()]).then(([enrolled, consulted]) =>
      setPrefs({ enrolled, consulted }),
    );
  }, []);

  // §3 : sélection initiale une seule fois, dès que prefs + flotte sont dispo.
  useEffect(() => {
    if (didInitRef.current || !prefs || vehicles.length === 0) return;
    const target = pickInitial(vehicles, prefs.enrolled, prefs.consulted);
    if (target == null) return;
    didInitRef.current = true;
    selectVehicle(target, { persist: false }); // ne pas écraser le dernier consulté
  }, [prefs, vehicles, selectVehicle]);

  // Premier cadrage caméra : attend que la carte soit prête (animateToRegion
  // est un no-op avant `onMapReady`). Les sélections ultérieures cadrent direct.
  useEffect(() => {
    if (framedRef.current || !mapReady || !active) return;
    framedRef.current = true;
    frameVehicle(active);
  }, [mapReady, active, frameVehicle]);

  // §4 : deep-link depuis la liste. Le param prend le dessus sur la sélection
  // initiale ; on l'efface après consommation pour que retaper le MÊME véhicule
  // (valeur undefined → id) re-déclenche le focus.
  useEffect(() => {
    if (routeVehicleId == null) return;
    didInitRef.current = true;
    selectVehicle(routeVehicleId);
    tabNav.setParams({ vehicleId: undefined });
  }, [routeVehicleId, selectVehicle, tabNav]);

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

  // Adresse en clair (reverse geocoding) du véhicule actif quand Traccar n'en
  // fournit pas. Mémorisée par véhicule pour éviter les appels répétés.
  useEffect(() => {
    const v = active;
    if (!v || v.addr || v.lat == null || v.lng == null || addrCache[v.id]) return;
    let alive = true;
    Location.reverseGeocodeAsync({ latitude: Number(v.lat), longitude: Number(v.lng) })
      .then((res) => {
        const a = res[0];
        if (!alive || !a) return;
        const parts = [a.name ?? a.street, a.district ?? a.subregion, a.city ?? a.region, a.country];
        const text = Array.from(new Set(parts.filter((p): p is string => !!p))).join(", ");
        if (text) setAddrCache((c) => ({ ...c, [v.id]: text }));
      })
      .catch(() => {
        /* reverse geocoding indisponible → on garde « adresse indisponible » */
      });
    return () => {
      alive = false;
    };
  }, [active, addrCache]);

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
        onMapReady={() => setMapReady(true)}
        mapType={mapType}
        showsMyLocationButton={false}
        showsUserLocation={focused && locGranted}
        clusteringEnabled
        minPoints={2}
        radius={48}
        clusterColor={ACCENT}
        clusterTextColor={LIME_ON}
      >
        {traceOn && trace.length > 1 ? <Polyline coordinates={trace} strokeColor={TRACK} strokeWidth={4} /> : null}
        {/* §1 : TOUS les véhicules ayant une position sont rendus en permanence —
            jamais filtrés sur la sélection. `key` = id du device (stable entre ticks).
            Chaque marqueur expose `coordinate` (lu par le clustering) ; la position
            exacte est préservée au dé-clustering. §5 : un seul tap → selectVehicle. */}
        {vehicles
          .filter((v) => v.lat && v.lng)
          .map((v) => (
            <VehicleMarker
              key={v.id}
              v={v}
              coordinate={{ latitude: Number(v.lat), longitude: Number(v.lng) }}
              active={v.id === activeId}
              onPress={() => selectVehicle(v.id)}
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
        <MapTypeButton t={t} mapType={mapType} onToggle={() => setMapType(toggleMapType)} />
        <GlassButton t={t} icon={Crosshair} size={38} color={t.accentMuted} onPress={() => frameVehicle(active)} />
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
              <Text numberOfLines={2} style={{ fontSize: 12, color: t.sub, marginTop: 2, fontFamily: font.body.regular }}>
                {active.addr ?? addrCache[active.id] ?? tr("common.noAddress")}
              </Text>
              {isStale(active.lastSeen) ? (
                <Text style={{ fontSize: 11, color: ALERT, marginTop: 2, fontFamily: font.body.medium }}>
                  {tr("map.stale")} · {relAge(active.lastSeen)}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            <Metric t={t} label={tr("common.speed")} value={`${convSpeed(active.speed, units)}`} unit={speedUnit(units, tr)} />
            {/* §1 : batterie en % réel + éclair de charge quand `charge === true`. */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Metric t={t} label={tr("common.battery")} value={active.battery != null ? `${active.battery}` : tr("common.na")} unit={active.battery != null ? "%" : undefined} />
              {active.charge === true ? (
                <View style={{ position: "absolute", top: 4, right: 5 }}>
                  <BatteryCharging size={12} color={ONLINE} />
                </View>
              ) : null}
            </View>
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
            <Power size={11} color={active.acc == null ? t.sub : active.acc ? ONLINE : OFFLINE} style={{ marginLeft: 8 }} />
            <Text style={{ fontSize: 11, color: t.sub, fontFamily: font.body.regular }}>
              {tr("detail.acc")} · {active.acc == null ? tr("common.na") : active.acc ? tr("common.ignOn") : tr("common.ignOff")}
            </Text>
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
