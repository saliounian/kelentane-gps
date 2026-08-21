import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { iconForVehicle } from "../../icons/vehicleIcons";
import type { VehicleVM } from "../../types/vehicle";

type Props = { v: Pick<VehicleVM, "iconKey" | "type" | "color">; size?: number; onIconLoad?: () => void };

// Pin de géolocalisation (tête ronde + pointe basse) dans un repère 100×130.
// `size` = DIAMÈTRE DE LA TÊTE (compatibilité avec l'ancien cercle) ; la boîte du
// pin en dérive. La pointe (bas-centre) marque le point exact — les marqueurs qui
// utilisent ce glyphe ancrent dessus (voir PIN_TIP_Y / PIN_HEAD_CY).
const PIN_PATH = "M50 126 C 28 96 12 78 12 48 A 38 38 0 1 1 88 48 C 88 78 72 96 50 126 Z";
export const PIN_W_RATIO = 100 / 76; // boîte largeur / diamètre tête (tête ≈ 76 u)
export const PIN_H_RATIO = (130 / 76); // boîte hauteur / diamètre tête
export const PIN_TIP_Y = 126 / 130; // fraction verticale de la pointe (ancre)
export const PIN_HEAD_CY = 48 / 130; // fraction verticale du centre de la tête

/**
 * Pin couleur (statut/identité) + icône véhicule dans la tête ronde + contour blanc.
 * Cœur visuel PARTAGÉ entre le marqueur carte (VehicleMarker) et le curseur de
 * lecture Trajectoire → forme cohérente partout (évite la duplication).
 * Seule la FORME a changé (cercle → pin) ; la couleur (`v.color`, par statut) est
 * conservée telle quelle. `onIconLoad` : relayé pour synchroniser le snapshot natif.
 */
export function VehicleGlyph({ v, size = 32, onIconLoad }: Props) {
  const Icon = iconForVehicle(v);
  const W = size * PIN_W_RATIO;
  const H = size * PIN_H_RATIO;
  const icon = Math.round(size * 0.5);
  return (
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H} viewBox="0 0 100 130">
        <Path d={PIN_PATH} fill={v.color} stroke="#fff" strokeWidth={6} strokeLinejoin="round" />
      </Svg>
      {/* Icône du type de véhicule, centrée dans la partie ronde (haute) du pin. */}
      <View
        style={{
          position: "absolute",
          left: W / 2 - icon / 2,
          top: H * PIN_HEAD_CY - icon / 2,
          width: icon,
          height: icon,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={icon} color="#fff" onLoad={onIconLoad} />
      </View>
    </View>
  );
}
