import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { LIME, hexA } from "../../theme/tokens";
import { font } from "../../theme/fonts";
import { iconForVehicle } from "../../icons/vehicleIcons";
import type { VehicleVM } from "../../types/vehicle";

// `coordinate` : lu par react-native-map-clustering pour positionner/regrouper le
// marqueur (le composant conserve par ailleurs sa propre position interne).
type Props = { v: VehicleVM; active: boolean; onPress: () => void; coordinate?: { latitude: number; longitude: number } };

/**
 * Marqueur véhicule : pastille couleur = STATUT, icône blanche, anneau blanc.
 * Le lime n'apparaît que sur le PULSE de sélection (marque/sélection), jamais
 * comme couleur de statut (règle absolue).
 */
export function VehicleMarker({ v, active, onPress }: Props) {
  const lat = v.lat ? Number(v.lat) : null;
  const lng = v.lng ? Number(v.lng) : null;
  const pulse = useRef(new Animated.Value(0)).current;
  const Icon = iconForVehicle(v);

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (lat === null || lng === null) return null;

  const size = active ? 40 : 32;
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });

  return (
    // Label nom TOUJOURS visible (indépendant du popup). anchor.y décalé pour que
    // le centre de la pastille reste sur la coordonnée malgré le label sous l'icône.
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.37 }}
      tracksViewChanges={active}
    >
      <View style={{ alignItems: "center" }}>
        <View style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center" }}>
          {active ? (
            <Animated.View
              style={{
                position: "absolute",
                width: 54,
                height: 54,
                borderRadius: 27,
                borderWidth: 2,
                borderColor: LIME,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              }}
            />
          ) : null}
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: v.color,
              borderWidth: 2.5,
              borderColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: v.color,
              shadowOpacity: 0.6,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Icon size={active ? 20 : 16} color="#fff" />
          </View>
        </View>
        {/* Pastille nom — lisible sur carte claire ET satellite (fond translucide clair). */}
        <View
          style={{
            marginTop: -1,
            maxWidth: 132,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 7,
            backgroundColor: "rgba(255,255,255,0.94)",
            borderWidth: 0.5,
            borderColor: "rgba(15,21,36,0.14)",
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
          }}
        >
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, color: "#0F1524", fontFamily: font.body.bold, textAlign: "center" }}
          >
            {v.name}
          </Text>
        </View>
      </View>
    </Marker>
  );
}
