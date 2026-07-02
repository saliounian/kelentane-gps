import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutRectangle, Pressable, ScrollView, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { ChevronLeft, Clock, MapPin, Pause, Play, RotateCcw } from "lucide-react-native";
import { ACCENT, ALERT, hexA, ONLINE, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { fetchRoute } from "../data/reports";
import { Glass, GlassButton, Metric } from "../ui";
import type { RootStackParamList } from "../navigation/types";
import type { RoutePoint } from "../types/reports";

function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const SPEEDS = { Lent: 0.4, Moyen: 0.9, Vite: 1.8 } as const;
type SpeedMode = keyof typeof SPEEDS;

export function TrajectoryScreen() {
  const { t, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "Traj">>();
  const [pts, setPts] = useState<RoutePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMode, setSpeedMode] = useState<SpeedMode>("Moyen");
  const [track, setTrack] = useState<LayoutRectangle | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchRoute(params.vehicleId);
        if (!alive) return;
        setPts(r);
        setError(r.length ? null : "Aucun trajet sur la période");
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.vehicleId]);

  useEffect(() => {
    if (!playing || pts.length < 2) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const np = p + 0.006 * SPEEDS[speedMode];
        if (np >= 1) {
          setPlaying(false);
          return 1;
        }
        return np;
      });
    }, 40);
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
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* carte */}
        <View style={{ height: 280 }}>
          <MapView ref={mapRef} provider={PROVIDER_DEFAULT} style={{ flex: 1 }} initialRegion={region}>
            {coords.length > 1 ? <Polyline coordinates={coords} strokeColor={ONLINE} strokeWidth={4} /> : null}
            {cur ? (
              <Marker coordinate={{ latitude: cur.lat, longitude: cur.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff", borderWidth: 3, borderColor: ACCENT }} />
              </Marker>
            ) : null}
          </MapView>
          <View style={{ position: "absolute", top: insets.top + 8, left: 14 }}>
            <GlassButton t={t} icon={ChevronLeft} size={38} onPress={() => nav.goBack()} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 14, marginTop: -22, gap: 12 }}>
          <Glass t={t} dark={dark} style={{ padding: 16 }}>
            {/* lecture live */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>Lecture du trajet</Text>
              <Text style={{ fontSize: 22, color: cur && cur.speed > 0 ? ACCENT : t.sub, fontFamily: font.mono.semibold }}>
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
                  <MapPin size={13} color={cur.speed > 0 ? ACCENT : t.sub} />
                  <Text style={{ flex: 1, fontSize: 12.5, color: t.text, lineHeight: 18, fontFamily: font.body.regular }}>{cur.addr ?? `${cur.lat.toFixed(5)}, ${cur.lng.toFixed(5)}`}</Text>
                </View>
              </View>
            ) : (
              <Text style={{ color: t.sub, marginTop: 10, fontFamily: font.body.regular }}>{error ?? "Chargement…"}</Text>
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
                <Text style={{ fontSize: 12, color: ACCENT, fontFamily: font.body.bold }}>{speedMode}</Text>
              </Pressable>
              <GlassButton t={t} icon={RotateCcw} onPress={() => (setProgress(0), setPlaying(true))} />
            </View>
          </Glass>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Metric t={t} label="Distance" value={summary.dist} unit="km" />
            <Metric t={t} label="Durée" value={summary.dur} />
            <Metric t={t} label="Vit. max" value={`${summary.max}`} unit="km/h" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
