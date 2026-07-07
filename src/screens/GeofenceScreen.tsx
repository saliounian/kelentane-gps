import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, LayoutRectangle, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import MapView, { Circle, Marker, Polygon, PROVIDER_DEFAULT, type LatLng, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, Fence, Plus, RotateCcw, X } from "lucide-react-native";
import { ACCENT, hexA, LIME_ON, PARKED } from "../theme/tokens";
import { font } from "../theme/fonts";
import { useTheme } from "../theme/ThemeProvider";
import { useVehicles } from "../data/useVehicles";
import { createGeofence, deleteGeofence, fetchGeofences, patchGeofence } from "../data/geofences";
import { Glass, GlassButton, Toggle } from "../ui";
import type { RootStackParamList } from "../navigation/types";
import type { GeofenceVM } from "../types/geofence";

const DAKAR: Region = { latitude: 14.6928, longitude: -17.4467, latitudeDelta: 0.06, longitudeDelta: 0.06 };
const R_MIN = 50;
const R_MAX = 1000;

export function GeofenceScreen() {
  const { t, dark } = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, "Geo">>();
  const { vehicles } = useVehicles();
  const v = vehicles.find((x) => x.id === params.vehicleId);

  const [view, setView] = useState<"list" | "edit">("list");
  const [zones, setZones] = useState<GeofenceVM[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"polygon" | "circle">("polygon");
  const [points, setPoints] = useState<LatLng[]>([]);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [radius, setRadius] = useState(200);
  const [name, setName] = useState("Zone domicile");
  const [track, setTrack] = useState<LayoutRectangle | null>(null);
  const [saving, setSaving] = useState(false);

  const region: Region = useMemo(() => {
    if (v?.lat && v?.lng) return { latitude: Number(v.lat), longitude: Number(v.lng), latitudeDelta: 0.04, longitudeDelta: 0.04 };
    return DAKAR;
  }, [v]);

  const load = async () => {
    try {
      setZones(await fetchGeofences(params.vehicleId));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.vehicleId]);

  const reset = () => {
    setPoints([]);
    setCenter(null);
  };
  const canSave = (mode === "polygon" && points.length >= 3) || (mode === "circle" && !!center);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const body =
        mode === "circle" && center
          ? { name, kind: "circle" as const, area: { kind: "circle" as const, lat: center.latitude, lng: center.longitude, radius } }
          : { name, kind: "polygon" as const, area: { kind: "polygon" as const, points: points.map((p) => ({ lat: p.latitude, lng: p.longitude })) } };
      await createGeofence(params.vehicleId, body);
      reset();
      setView("list");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (z: GeofenceVM, on: boolean) => {
    setZones((arr) => arr.map((x) => (x.id === z.id ? { ...x, enabled: on } : x)));
    try {
      await patchGeofence(z.id, { enabled: on });
    } catch {
      load();
    }
  };
  const remove = async (z: GeofenceVM) => {
    setZones((arr) => arr.filter((x) => x.id !== z.id));
    try {
      await deleteGeofence(z.id);
    } catch {
      load();
    }
  };

  const renderZones = () =>
    zones.map((z) => {
      if (!z.area) return null;
      const col = z.color ?? (z.kind === "circle" ? PARKED : ACCENT);
      if (z.area.kind === "circle") {
        return (
          <Circle
            key={z.id}
            center={{ latitude: z.area.lat, longitude: z.area.lng }}
            radius={z.area.radius}
            strokeColor={col}
            fillColor={hexA(col, z.enabled ? 0.18 : 0.05)}
            strokeWidth={2}
          />
        );
      }
      return (
        <Polygon
          key={z.id}
          coordinates={z.area.points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
          strokeColor={col}
          fillColor={hexA(col, z.enabled ? 0.18 : 0.05)}
          strokeWidth={2}
        />
      );
    });

  /* ---------------- EDIT ---------------- */
  if (view === "edit") {
    const pointCount = mode === "polygon" ? points.length : center ? 1 : 0;
    const hint =
      mode === "polygon"
        ? points.length < 3
          ? tr("geo.needPoints", { n: 3 - points.length })
          : tr("geo.polyReady", { n: points.length })
        : center
          ? tr("geo.circleReady")
          : tr("geo.hintCircle");

    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        {/* Carte plein écran — reçoit les taps pour tracer la zone. */}
        <MapView
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={region}
          onPress={(e) => {
            const c = e.nativeEvent.coordinate;
            if (mode === "polygon") setPoints((p) => [...p, c]);
            else setCenter(c);
          }}
        >
          {mode === "polygon" && points.length > 0 ? (
            <>
              {points.length >= 3 ? <Polygon coordinates={points} strokeColor={ACCENT} fillColor={hexA(ACCENT, 0.18)} strokeWidth={2.5} /> : null}
              {points.map((p, i) => (
                <Marker key={i} coordinate={p} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff", borderWidth: 2.5, borderColor: ACCENT }} />
                </Marker>
              ))}
            </>
          ) : null}
          {mode === "circle" && center ? (
            <Circle center={center} radius={radius} strokeColor={ACCENT} fillColor={hexA(ACCENT, 0.18)} strokeWidth={2.5} />
          ) : null}
        </MapView>

        {/* Barre haute : retour + indice de tracé. */}
        <View style={{ position: "absolute", top: insets.top + 8, left: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <GlassButton t={t} icon={ChevronLeft} size={38} onPress={() => { reset(); setView("list"); }} />
          <Glass t={t} dark={dark} radius={10} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 11.5, color: t.sub, fontFamily: font.body.regular }}>{hint}</Text>
          </Glass>
        </View>

        {/* Panneau formulaire flottant, séparé de la carte, remonte avec le clavier. */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={{
              backgroundColor: t.glassSolid,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              borderWidth: 1,
              borderColor: t.border,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: Math.max(insets.bottom, 16) + 4,
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 18, color: t.text, fontFamily: font.display.extrabold }}>{tr("geo.newZone")}</Text>
                <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.mono.regular }}>{pointCount > 0 ? tr("geo.placed", { n: pointCount }) : ""}</Text>
              </View>

              <View style={{ flexDirection: "row", gap: 6, padding: 4, borderRadius: 13, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
                {([["polygon", tr("geo.polygon")], ["circle", tr("geo.circle")]] as const).map(([id, lbl]) => {
                  const on = mode === id;
                  return (
                    <Pressable key={id} onPress={() => { setMode(id); reset(); }} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: on ? ACCENT : "transparent" }}>
                      <Text style={{ fontSize: 13, color: on ? LIME_ON : t.text, fontFamily: font.body.semibold }}>{lbl}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {mode === "circle" ? (
                <Glass t={t} dark={dark} style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>{tr("geo.radius")}</Text>
                  <Pressable
                    onLayout={(e) => setTrack(e.nativeEvent.layout)}
                    onPress={(e) => {
                      if (!track) return;
                      const r = R_MIN + (e.nativeEvent.locationX / track.width) * (R_MAX - R_MIN);
                      setRadius(Math.round(Math.max(R_MIN, Math.min(R_MAX, r))));
                    }}
                    style={{ flex: 1, height: 24, justifyContent: "center" }}
                  >
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: hexA(t.text, 0.15) }}>
                      <View style={{ width: `${((radius - R_MIN) / (R_MAX - R_MIN)) * 100}%`, height: 4, borderRadius: 2, backgroundColor: ACCENT }} />
                    </View>
                  </Pressable>
                  <Text style={{ fontSize: 13, color: t.text, fontFamily: font.mono.semibold }}>{radius} m</Text>
                </Glass>
              ) : null}

              <View>
                <Text style={{ fontSize: 12, color: t.sub, marginBottom: 6, paddingLeft: 2, fontFamily: font.body.semibold }}>{tr("geo.zoneName")}</Text>
                <View style={{ height: 48, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
                  <Fence size={18} color={t.sub} />
                  <TextInput value={name} onChangeText={setName} placeholder="Zone domicile" placeholderTextColor={t.sub} style={{ flex: 1, color: t.text, fontSize: 15, fontFamily: font.body.regular }} />
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable onPress={reset} style={{ flex: 1, height: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
                <RotateCcw size={16} color={t.text} />
                <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.semibold }}>{tr("geo.clear")}</Text>
              </Pressable>
              <Pressable onPress={save} disabled={!canSave || saving} style={{ flex: 2, height: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: canSave ? ACCENT : hexA(t.text, 0.12) }}>
                <Check size={17} color={canSave ? LIME_ON : t.sub} />
                <Text style={{ fontSize: 14, color: canSave ? LIME_ON : t.sub, fontFamily: font.body.bold }}>{saving ? tr("geo.saving") : tr("geo.save")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  /* ---------------- LIST ---------------- */
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ height: 220 }}>
        <MapView provider={PROVIDER_DEFAULT} style={{ flex: 1 }} initialRegion={region}>
          {renderZones()}
        </MapView>
        <View style={{ position: "absolute", top: insets.top + 8, left: 14 }}>
          <GlassButton t={t} icon={ChevronLeft} size={38} onPress={() => nav.goBack()} />
        </View>
        <View style={{ position: "absolute", top: insets.top + 8, right: 14 }}>
          <Pressable onPress={() => { reset(); setView("edit"); }} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" }}>
            <Plus size={22} color={LIME_ON} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 20, color: t.text, fontFamily: font.display.extrabold }}>{tr("geo.title")}</Text>
        <Text style={{ fontSize: 12, color: t.sub, marginTop: -6, fontFamily: font.body.regular }}>{tr("geo.subtitle", { name: v?.name ?? "Véhicule" })}</Text>

        {error ? (
          <Text style={{ color: t.sub, fontSize: 13, marginTop: 10, fontFamily: font.body.regular }}>{error}</Text>
        ) : zones.length === 0 ? (
          <Glass t={t} dark={dark} style={{ padding: 22, alignItems: "center" }}>
            <Text style={{ color: t.sub, fontSize: 13, fontFamily: font.body.regular }}>{tr("geo.empty")}</Text>
          </Glass>
        ) : (
          <Glass t={t} dark={dark} style={{ padding: 4 }}>
            {zones.map((z, i) => {
              const col = z.color ?? (z.kind === "circle" ? PARKED : ACCENT);
              return (
                <View key={z.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 12, borderBottomWidth: i === zones.length - 1 ? 0 : 1, borderBottomColor: t.line }}>
                  <View style={{ width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: hexA(col, 0.16) }}>
                    <Fence size={16} color={col} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.semibold }}>{z.name}</Text>
                    <Text style={{ fontSize: 11.5, color: t.sub, fontFamily: font.body.regular }}>{z.kind === "circle" ? tr("geo.circle") : tr("geo.polygon")}</Text>
                  </View>
                  <Toggle t={t} on={z.enabled} set={(on) => toggle(z, on)} />
                  <Pressable onPress={() => remove(z)} style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: t.glass, borderWidth: 1, borderColor: t.border }}>
                    <X size={15} color={t.sub} />
                  </Pressable>
                </View>
              );
            })}
          </Glass>
        )}
      </ScrollView>
    </View>
  );
}
