import { Text, View } from "react-native";
import { hexA, statusColor, STATUS_LABEL, VehicleStatus } from "../theme/tokens";
import { font } from "../theme/fonts";

type PillProps = {
  status: VehicleStatus;
  /** Couleur explicite (défaut : dérivée du statut). Jamais le lime. */
  color?: string;
};

/** Pastille de statut : fond teinté + point + libellé FR. */
export function StatusPill({ status, color }: PillProps) {
  const c = color ?? statusColor(status);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: hexA(c, 0.16),
        alignSelf: "flex-start",
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
      <Text style={{ color: c, fontSize: 10.5, fontFamily: font.body.bold }}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

/** Point de statut nu (listes). */
export function StatusDot({ status, color }: PillProps) {
  const c = color ?? statusColor(status);
  return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c }} />;
}
