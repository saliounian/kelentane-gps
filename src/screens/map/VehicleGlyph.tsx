import { View } from "react-native";
import { iconForVehicle } from "../../icons/vehicleIcons";
import type { VehicleVM } from "../../types/vehicle";

type Props = { v: Pick<VehicleVM, "iconKey" | "type" | "color">; size?: number };

/**
 * Pastille couleur (statut/identité) + icône véhicule blanche + anneau blanc.
 * Cœur visuel PARTAGÉ entre le marqueur carte (VehicleMarker) et la Trajectoire,
 * pour cohérence de l'icône véhicule partout (évite la duplication).
 */
export function VehicleGlyph({ v, size = 32 }: Props) {
  const Icon = iconForVehicle(v);
  return (
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
      <Icon size={Math.round(size * 0.5)} color="#fff" />
    </View>
  );
}
