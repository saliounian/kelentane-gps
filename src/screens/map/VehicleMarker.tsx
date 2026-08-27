import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { AnimatedRegion, Marker, MarkerAnimated } from "react-native-maps";
import { LIME } from "../../theme/tokens";
import { font } from "../../theme/fonts";
import { PIN_H_RATIO, PIN_HEAD_CY, PIN_TIP_Y, PIN_W_RATIO, VehicleGlyph } from "./VehicleGlyph";
import type { VehicleVM } from "../../types/vehicle";

const LABEL_BLOCK = 18; // hauteur approx du bandeau nom sous le pin (pour l'ancre)

// Interpolation fluide du marqueur SUIVI (actif) entre deux points GPS réels.
// Durée = intervalle réel entre les deux points, borné pour rester agréable :
const ANIM_MIN_MS = 300; // plancher : évite un « pop » instantané sur points rapprochés
const ANIM_MAX_MS = 6000; // plafond : coupure réseau/GPS (>60 s) → pas de ramper trop lent
const ANIM_FALLBACK_MS = 1200; // horloges incohérentes (dt ≤ 0) → durée neutre

function pointTime(v: VehicleVM): number {
  return v.lastSeen ? new Date(v.lastSeen).getTime() : Date.now();
}

// `coordinate` : lu par react-native-map-clustering pour positionner/regrouper le
// marqueur (le composant conserve par ailleurs sa propre position interne).
type Props = { v: VehicleVM; active: boolean; onPress: () => void; coordinate?: { latitude: number; longitude: number } };

/**
 * Marqueur véhicule : pin de géolocalisation (tête ronde couleur = STATUT + icône
 * du type de véhicule dedans + pointe basse marquant la position exacte). Le lime
 * n'apparaît que sur le PULSE de sélection, jamais comme couleur de statut.
 *
 * Suivi actif : SEUL le marqueur du véhicule sélectionné (`active`) interpole
 * linéairement lat/lng entre deux points GPS reçus (rendu fluide au lieu d'un saut).
 * Les autres marqueurs gardent le saut direct (rendu `Marker` inchangé). Le pin étant
 * un repère de géoloc dont la POINTE marque la position exacte, on ne le fait pas
 * pivoter selon le cap (cela détacherait la pointe du point réel) — la rotation est
 * optionnelle dans la consigne. La polyline du tracé reste sur les points réels
 * (gérée en amont dans MapScreen) : aucune interpolation du tracé.
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

  // Coordonnée animée du marqueur suivi. Instance stable (persiste entre re-renders et
  // entre les bascules actif/inactif du MÊME marqueur), pilotée par timing() ci-dessous.
  const animCoord = useRef(
    new AnimatedRegion({ latitude: lat ?? 0, longitude: lng ?? 0, latitudeDelta: 0, longitudeDelta: 0 }),
  ).current;
  // Dernier point RÉEL vers lequel on a animé (pour calculer distance/durée du suivant).
  const prevPoint = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const wasActive = useRef(false);

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  // Interpolation du marqueur suivi. Ne s'exécute que pour le véhicule actif ; sinon on
  // resynchronise silencieusement la coordonnée animée pour qu'une activation ultérieure
  // reparte du bon endroit. Déps sur `lastSeen` (stable) plutôt que sur un Date.now()
  // recalculé à chaque rendu, pour ne pas déclencher d'animation fantôme.
  useEffect(() => {
    if (lat === null || lng === null) return;
    const justActivated = active && !wasActive.current;
    wasActive.current = active;

    if (!active) {
      // Marqueur non suivi : la vue rendue est un <Marker> statique (saut direct).
      // On garde juste la coordonnée animée à jour pour une future activation.
      animCoord.stopAnimation(() => {});
      animCoord.setValue({ latitude: lat, longitude: lng, latitudeDelta: 0, longitudeDelta: 0 });
      prevPoint.current = { lat, lng, t: pointTime(v) };
      return;
    }

    const tNow = pointTime(v);
    const prev = prevPoint.current;
    prevPoint.current = { lat, lng, t: tNow };

    // Activation, 1er point, ou position identique (véhicule à l'arrêt) → snap, pas d'animation.
    if (justActivated || !prev || (prev.lat === lat && prev.lng === lng)) {
      animCoord.stopAnimation(() => {});
      animCoord.setValue({ latitude: lat, longitude: lng, latitudeDelta: 0, longitudeDelta: 0 });
      return;
    }

    // Durée = intervalle réel entre les deux points, bornée. Un nouvel appel à timing()
    // pendant une animation en cours l'interrompt et repart de la position interpolée
    // courante (comportement natif d'Animated.Value) → pas d'à-coup ni de retour arrière.
    const dt = tNow - prev.t;
    const duration = Math.min(Math.max(dt > 0 ? dt : ANIM_FALLBACK_MS, ANIM_MIN_MS), ANIM_MAX_MS);
    // `toValue` est requis par le typage de TimingAnimationConfig mais AnimatedRegion.timing
    // le dérive lui-même par champ (latitude/longitude) → cast pour satisfaire TS.
    animCoord
      .timing({ latitude: lat, longitude: lng, latitudeDelta: 0, longitudeDelta: 0, duration, useNativeDriver: false } as any)
      .start();
  }, [active, lat, lng, v.lastSeen, animCoord]);

  // Cleanup : au démontage du marqueur, stopper toute animation en cours.
  useEffect(() => () => animCoord.stopAnimation(() => {}), [animCoord]);

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

  // Contenu visuel partagé entre le marqueur animé (actif) et statique (inactif).
  const content = (
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
  );

  // §5 : ni `title`/`description` ni enfant <Callout> → aucune bulle native n'est créée,
  // donc rien n'intercepte le tap. Un seul tap sur l'icône OU le label déclenche `onPress`.
  //
  // Véhicule suivi → MarkerAnimated piloté par la coordonnée interpolée (glissement fluide).
  // Autres véhicules → Marker statique sur la position réelle (saut direct, inchangé).
  return active ? (
    <MarkerAnimated
      coordinate={animCoord as unknown as { latitude: number; longitude: number }}
      onPress={onPress}
      anchor={{ x: 0.5, y: anchorY }}
      tracksViewChanges
    >
      {content}
    </MarkerAnimated>
  ) : (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      onPress={onPress}
      anchor={{ x: 0.5, y: anchorY }}
      tracksViewChanges={!iconReady}
    >
      {content}
    </Marker>
  );
}
