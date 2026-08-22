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
      color={mapType === "hybrid" ? ACCENT : t.text}
      onPress={onToggle}
    />
  );
}

/** Bascule standard ↔ hybrid (util partagé pour le setState). "hybrid" = imagerie
 *  satellite AVEC labels (rues/lieux), contrairement à "satellite" qui les masque. */
export const toggleMapType = (m: MapType): MapType => (m === "hybrid" ? "standard" : "hybrid");
