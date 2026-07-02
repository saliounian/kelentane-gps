import { Text, View } from "react-native";
import { ACCENT, LIME_ON } from "../theme/tokens";
import { font } from "../theme/fonts";

/** Monogramme K lime (logo marque). Maquette : `KMonogram`. */
export function KMonogram({ size = 38 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: ACCENT,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: ACCENT,
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Text
        style={{
          color: LIME_ON,
          fontSize: size * 0.58,
          letterSpacing: -1,
          fontFamily: font.display.black,
        }}
      >
        K
      </Text>
    </View>
  );
}
