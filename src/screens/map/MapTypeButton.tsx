import { Layers } from "lucide-react-native";
import type { MapType } from "react-native-maps";
import { ACCENT, type Theme } from "../../theme/tokens";
import { GlassButton } from "../../ui";

type Props = { t: Theme; mapType: MapType; onToggle: () => void };

/**
 * Switch plan/satellite PARTAGÉ (MapScreen + Trajectoire) : même GlassButton,
 * même code couleur (accent quand satellite actif). Évite la duplication.
 */
export function MapTypeButton({ t, mapType, onToggle }: Props) {
  return (
    <GlassButton
      t={t}
      icon={Layers}
      size={38}
      color={mapType === "satellite" ? ACCENT : t.text}
      onPress={onToggle}
    />
  );
}

/** Bascule standard ↔ satellite (util partagé pour le setState). */
export const toggleMapType = (m: MapType): MapType => (m === "satellite" ? "standard" : "satellite");
