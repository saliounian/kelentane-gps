import { Pressable, Text, View } from "react-native";
import { hexA, ONLINE, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";

type Props = {
  t: Theme;
  on: boolean;
  set: (v: boolean) => void;
  label?: string;
  /** Grande taille (interrupteur maître Alarmes). */
  large?: boolean;
};

/** Interrupteur. ON = teal ONLINE (jamais lime). Maquette : `Toggle`. */
export function Toggle({ t, on, set, label, large }: Props) {
  const w = large ? 52 : 40;
  const h = large ? 30 : 24;
  const knob = large ? 24 : 20;
  const pad = large ? 3 : 2;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      {label ? (
        <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>{label}</Text>
      ) : null}
      <Pressable
        onPress={() => set(!on)}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        style={{
          width: w,
          height: h,
          borderRadius: 999,
          padding: pad,
          backgroundColor: on ? ONLINE : hexA(t.text, 0.2),
          alignItems: on ? "flex-end" : "flex-start",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: knob,
            height: knob,
            borderRadius: knob / 2,
            backgroundColor: "#fff",
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
          }}
        />
      </Pressable>
    </View>
  );
}
