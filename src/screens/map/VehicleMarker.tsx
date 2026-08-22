import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { LIME } from "../../theme/tokens";
import { font } from "../../theme/fonts";
import { PIN_H_RATIO, PIN_HEAD_CY, PIN_TIP_Y, PIN_W_RATIO, VehicleGlyph } from "./VehicleGlyph";
import type { VehicleVM } from "../../types/vehicle";

const LABEL_BLOCK = 18; // hauteur approx du bandeau nom sous le pin (pour l'ancre)

// `coordinate` : lu par react-native-map-clustering pour positionner/regrouper le
// marqueur (le composant conserve par ailleurs sa propre position interne).
type Props = { v: VehicleVM; active: boolean; onPress: () => void; coordinate?: { latitude: number; longitude: number } };

/**
 * Marqueur véhicule : pin de géolocalisation (tête ronde couleur = STATUT + icône
 * du type de véhicule dedans + pointe basse marquant la position exacte). Le lime
 * n'apparaît que sur le PULSE de sélection, jamais comme couleur de statut.
 */
export function VehicleMarker({ v, active, onPress }: Props) {
  const lat = v.lat ? Number(v.lat) : null;
  const lng = v.lng ? Number(v.lng) : null;
  const pulse = useRef(new Animated.Value(0)).current;
  // §1 : le marqueur natif fige (snapshot) sa vue quand `tracksViewChanges` passe à
  // false. Si l'icône PNG n'est pas encore décodée à cet instant, il capture une vue
  // VIDE et ne se rafraîchit jamais → icônes lentes/absentes à l'ouverture. On garde
  // le tracking actif tant que l'icône n'a pas signalé `onLoad`, puis on fige.
  const [iconReady, setIconReady] = useState(false);

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (lat === null || lng === null) return null;

  const size = active ? 40 : 32; // diamètre de la TÊTE du pin
  const pinW = size * PIN_W_RATIO;
  const pinH = size * PIN_H_RATIO;
  const ringD = size * 1.34; // anneau de sélection autour de la tête ronde
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  // Ancre : la POINTE du pin (bas-centre) tombe sur la coordonnée exacte. Le bandeau
  // nom en flux normal sous le pin décale la hauteur totale → on corrige l'ancre.
  const anchorY = (pinH * PIN_TIP_Y) / (pinH + LABEL_BLOCK);

  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={onPress}
      anchor={{ x: 0.5, y: anchorY }}
      // §5 : ni `title`/`description` ni enfant <Callout> → aucune bulle native
      // n'est créée, donc rien n'intercepte le tap. Un seul tap sur l'icône OU le
      // label déclenche `onPress` (selectVehicle) — pas de double-tap.
      tracksViewChanges={active || !iconReady}
    >
      <View style={{ alignItems: "center" }}>
        <View style={{ width: pinW, height: pinH, alignItems: "center" }}>
          {active ? (
            // Anneau pulsé centré sur la TÊTE du pin (pas sur la boîte entière).
            <Animated.View
              style={{
                position: "absolute",
                width: ringD,
                height: ringD,
                borderRadius: ringD / 2,
                borderWidth: 2,
                borderColor: LIME,
                left: pinW / 2 - ringD / 2,
                top: pinH * PIN_HEAD_CY - ringD / 2,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              }}
            />
          ) : null}
          <VehicleGlyph v={v} size={size} onIconLoad={() => setIconReady(true)} />
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
