import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutRectangle, Pressable, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type MapType, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Clock, MapPin, Pause, Play, RotateCcw } from "lucide-react-native";
import { ACCENT, ALERT, hexA, LIME_ON, TRACK } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { fetchRoute } from "../data/reports";
import { reverseGeocodeShort } from "../data/geocode";
import { logError, toUserMessage } from "../data/errorMessages";
import { DateRangeSheet, ErrorState, Glass, GlassButton, Metric, Skeleton } from "../ui";
import { useVehicles } from "../data/useVehicles";
import { useIconOverrides } from "../state/iconOverrides";
import { VehicleGlyph } from "./map/VehicleGlyph";
import { MapTypeButton, toggleMapType } from "./map/MapTypeButton";
import type { RootStackParamList } from "../navigation/types";
import type { RoutePoint } from "../types/reports";

const fmtShort = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// §3 : vitesses de lecture recalibrées (~3-4× plus lentes que l'origine 0.4/0.9/1.8).
// Nouveau « Vite » = ancien « Lent ». Tout se règle ici après test visuel terrain :
// avancement par tick = PROGRESS_STEP × SPEEDS[mode], un tick toutes les TICK_MS.
const SPEEDS = { Lent: 0.1, Moyen: 0.2, Vite: 0.4 } as const;
const PROGRESS_STEP = 0.006; // fraction du trajet par tick, avant multiplicateur
const TICK_MS = 40;
type SpeedMode = keyof typeof SPEEDS;

// §2 : période de l'historique. Bornes calculées en HEURE LOCALE (device/Dakar).
type TrajRange = "today" | "week" | "custom";

export function TrajectoryScreen() {
  const { t, dark } = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "Traj">>();
  const [pts, setPts] = useState<RoutePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // §5 : skeleton tant que l'historique charge
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMode, setSpeedMode] = useState<SpeedMode>("Moyen");
  const [track, setTrack] = useState<LayoutRectangle | null>(null);
  const [mode, setMode] = useState<TrajRange>("today");
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [perso, setPerso] = useState(false);
  const [nonce, setNonce] = useState(0); // §5 : relance manuelle après erreur
  const [mapType, setMapType] = useState<MapType>("standard");
  const mapRef = useRef<MapView>(null);
  // Icône réelle du véhicule (cohérence carte) : résolue via la liste + override local.
  const { vehicles } = useVehicles();
  const { overrides } = useIconOverrides();
  const veh = vehicles.find((v) => v.id === params.vehicleId);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let from: string;
        let to: string;
        if (mode === "custom") {
          if (!customFrom || !customTo) {
            setLoading(false);
            return; // plage pas encore choisie
          }
          from = customFrom.toISOString();
          to = customTo.toISOString();
        } else {
          // §2 : bornes en heure LOCALE. Aujourd'hui = minuit local → maintenant ;
          // Cette semaine = lundi 00:00 local → maintenant. `setHours(0,0,0,0)` opère
          // dans le fuseau local de l'appareil ; `toISOString()` convertit en UTC pour l'API.
          const end = new Date();
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          if (mode === "week") {
            const dow = (start.getDay() + 6) % 7; // 0 = lundi … 6 = dimanche
            start.setDate(start.getDate() - dow);
          }
          from = start.toISOString();
          to = end.toISOString();
        }
        const r = await fetchRoute(params.vehicleId, from, to);
        if (!alive) return;
        setPts(r);
        setProgress(0);
        setPlaying(false);
      } catch (e) {
        if (alive) {
          logError("TrajectoryScreen.fetchRoute", e);
          setError(toUserMessage(e));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.vehicleId, mode, customFrom, customTo, nonce]);

  const customLabel = mode === "custom" && customFrom && customTo ? `${fmtShort(customFrom)}–${fmtShort(customTo)}` : tr("km.custom");
  const chips: { id: TrajRange; label: string }[] = [
    { id: "today", label: tr("traj.today") },
    { id: "week", label: tr("traj.week") },
    { id: "custom", label: customLabel },
  ];

  useEffect(() => {
    if (!playing || pts.length < 2) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const np = p + PROGRESS_STEP * SPEEDS[speedMode];
        if (np >= 1) {
          setPlaying(false);
          return 1;
        }
        return np;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, speedMode, pts.length]);

  const region = useMemo<Region>(() => {
    if (pts.length === 0) return { latitude: 14.6928, longitude: -17.4467, latitudeDelta: 0.09, longitudeDelta: 0.09 };
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
      longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.5),
    };
  }, [pts]);

  const idx = pts.length ? Math.min(pts.length - 1, Math.round(progress * (pts.length - 1))) : 0;
  const cur = pts[idx];
  const coords = pts.map((p) => ({ latitude: p.lat, longitude: p.lng }));

  // §1 : nom de lieu du point en cours. Adresse Traccar prioritaire (`cur.addr`,
  // même source que le popup carte). Sinon repli géocodage inverse du SEUL point
  // courant, debounced (~400 ms → pas d'appel par frame) + caché par coordonnée.
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!cur || cur.addr) {
      setGeoLabel(null);
      return;
    }
    let alive = true;
    const { lat, lng } = cur;
    const id = setTimeout(() => {
      void reverseGeocodeShort(lat, lng).then((label) => {
        if (alive) setGeoLabel(label);
      });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [cur?.addr, cur?.lat, cur?.lng]);
  const glyphV = veh ? { iconKey: overrides[veh.id] ?? veh.iconKey, type: veh.type, color: veh.color } : null;

  const summary = useMemo(() => {
    let dist = 0;
    let max = 0;
    for (let i = 1; i < pts.length; i++) dist += haversine(pts[i - 1], pts[i]);
    for (const p of pts) max = Math.max(max, p.speed);
    const durMs = pts.length ? new Date(pts[pts.length - 1].time).getTime() - new Date(pts[0].time).getTime() : 0;
    const h = Math.floor(durMs / 3600000);
    const m = Math.floor((durMs % 3600000) / 60000);
    return { dist: dist.toFixed(1), dur: `${h}h${String(m).padStart(2, "0")}`, max };
  }, [pts]);

  const seek = (x: number) => {
    if (!track) return;
    setProgress(Math.max(0, Math.min(1, x / track.width)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Carte PLEIN ÉCRAN (fond) — POI + zoom/déplacement natifs préservés. */}
      <MapView ref={mapRef} provider={PROVIDER_DEFAULT} style={{ flex: 1 }} initialRegion={region} mapType={mapType}>
        {coords.length > 1 ? <Polyline coordinates={coords} strokeColor={TRACK} strokeWidth={4} /> : null}
        {cur ? (
          <Marker coordinate={{ latitude: cur.lat, longitude: cur.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            {/* Vraie icône du véhicule (cohérence app) ; fallback point si pas encore chargée. */}
            {glyphV ? (
              <VehicleGlyph v={glyphV} size={34} />
            ) : (
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff", borderWidth: 3, borderColor: ACCENT }} />
            )}
          </Marker>
        ) : null}
      </MapView>

      {/* Retour (overlay haut) */}
      <View style={{ position: "absolute", top: insets.top + 8, left: 14 }}>
        <GlassButton t={t} icon={ChevronLeft} size={38} onPress={() => nav.goBack()} />
      </View>

      {/* Switch plan/satellite (cohérent avec MapScreen) */}
      <View style={{ position: "absolute", top: insets.top + 8, right: 14 }}>
        <MapTypeButton t={t} mapType={mapType} onToggle={() => setMapType(toggleMapType)} />
      </View>

      {/* Contrôles en overlay flottant BAS. `box-none` : les gestes carte passent
          dans les vides ; seuls les panneaux/contrôles captent le toucher. */}
      <View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + 12, gap: 10 }}>
        {/* §2 : période — Aujourd'hui (minuit local) / Cette semaine (lundi 00:00 local) / Perso */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {chips.map((c) => {
            const on = mode === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => (c.id === "custom" ? setPerso(true) : setMode(c.id))}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: on ? ACCENT : t.glassSolid, borderWidth: 1, borderColor: on ? ACCENT : t.border }}
              >
                <Text style={{ fontSize: 13, color: on ? LIME_ON : t.text, fontFamily: font.body.semibold }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Glass t={t} dark={dark} style={{ padding: 16, backgroundColor: t.glassSolid }}>
          {/* lecture live */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>{tr("traj.playback")}</Text>
            <Text style={{ fontSize: 22, color: cur && cur.speed > 0 ? t.accentMuted : t.sub, fontFamily: font.mono.semibold }}>
              {cur?.speed ?? 0}
              <Text style={{ fontSize: 11, color: t.sub }}> km/h</Text>
            </Text>
          </View>

          {cur ? (
            <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: t.glass, borderWidth: 1, borderColor: t.line }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Clock size={12} color={t.sub} />
                <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.mono.regular }}>{new Date(cur.time).toLocaleString("fr-FR")}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                <MapPin size={13} color={cur.speed > 0 ? t.accentMuted : t.sub} />
                <Text style={{ flex: 1, fontSize: 12.5, color: t.text, lineHeight: 18, fontFamily: font.body.regular }}>{cur.addr ?? geoLabel ?? tr("common.loading")}</Text>
              </View>
            </View>
          ) : error ? (
            // §4/§5 : erreur = message TRADUIT + action ; jamais de texte technique.
            <ErrorState t={t} message={error} onRetry={() => setNonce((n) => n + 1)} />
          ) : loading ? (
            // §5 : chargement de l'historique = section entière → skeleton.
            <View style={{ gap: 8, marginTop: 10 }}>
              <Skeleton t={t} height={16} width="45%" />
              <Skeleton t={t} height={16} width="80%" />
            </View>
          ) : (
            // Période sans aucun point : état VIDE (pas une erreur, pas de « Réessayer »).
            <Text style={{ color: t.sub, marginTop: 10, fontFamily: font.body.regular }}>{tr("traj.noTrip")}</Text>
          )}

          {/* transport */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
            <Pressable
              onPress={() => (progress >= 1 ? (setProgress(0), setPlaying(true)) : setPlaying((p) => !p))}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: ALERT, alignItems: "center", justifyContent: "center" }}
            >
              {playing ? <Pause size={19} color="#fff" /> : <Play size={19} color="#fff" />}
            </Pressable>
            <Pressable
              onLayout={(e) => setTrack(e.nativeEvent.layout)}
              onPress={(e) => seek(e.nativeEvent.locationX)}
              style={{ flex: 1, height: 24, justifyContent: "center" }}
            >
              <View style={{ height: 4, borderRadius: 2, backgroundColor: hexA(t.text, 0.15) }}>
                <View style={{ width: `${progress * 100}%`, height: 4, borderRadius: 2, backgroundColor: ACCENT }} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => setSpeedMode((m) => (m === "Lent" ? "Moyen" : m === "Moyen" ? "Vite" : "Lent"))}
              style={{ paddingHorizontal: 10, height: 32, borderRadius: 10, justifyContent: "center", backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}
            >
              <Text style={{ fontSize: 12, color: t.accentMuted, fontFamily: font.body.bold }}>{speedMode === "Lent" ? tr("traj.slow") : speedMode === "Moyen" ? tr("traj.medium") : tr("traj.fast")}</Text>
            </Pressable>
            <GlassButton t={t} icon={RotateCcw} onPress={() => (setProgress(0), setPlaying(true))} />
          </View>
        </Glass>

        {/* stats — non interactives : `none` laisse la carte pannable en dessous */}
        <View pointerEvents="none" style={{ flexDirection: "row", gap: 8 }}>
          <Metric t={t} label={tr("traj.distance")} value={summary.dist} unit="km" />
          <Metric t={t} label={tr("traj.duration")} value={summary.dur} />
          <Metric t={t} label={tr("traj.maxSpeed")} value={`${summary.max}`} unit="km/h" />
        </View>
      </View>

      <DateRangeSheet
        t={t}
        visible={perso}
        initialFrom={customFrom}
        initialTo={customTo}
        onApply={(from, to) => {
          setCustomFrom(from);
          setCustomTo(to);
          setMode("custom");
          setPerso(false);
        }}
        onClose={() => setPerso(false)}
      />
    </View>
  );
}
