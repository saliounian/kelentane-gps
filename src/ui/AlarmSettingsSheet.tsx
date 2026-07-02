import { ScrollView, Text, View } from "react-native";
import { hexA, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { ALARM_TYPES, type AlarmCat } from "../data/alarmTypes";
import { BottomSheet } from "./BottomSheet";
import { Toggle } from "./Toggle";

type Props = {
  t: Theme;
  visible: boolean;
  enabled: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
  onClose: () => void;
};

const GROUPS: { cat: AlarmCat; title: string }[] = [
  { cat: "event", title: "Alarmes (événements)" },
  { cat: "anomaly", title: "Anomalies (dispositif)" },
];

/** Réglages par type d'alarme (maquette AlarmSettingsSheet). */
export function AlarmSettingsSheet({ t, visible, enabled, onToggle, onClose }: Props) {
  return (
    <BottomSheet t={t} visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, paddingHorizontal: 4 }}>
        Réglages des alertes
      </Text>
      <Text style={{ fontSize: 12, color: t.sub, paddingHorizontal: 4, paddingBottom: 6, fontFamily: font.body.regular }}>
        Active ou désactive chaque type.
      </Text>
      <ScrollView style={{ maxHeight: 460 }}>
        {GROUPS.map((g) => (
          <View key={g.cat}>
            <Text style={{ fontSize: 12, color: t.sub, paddingTop: 10, paddingHorizontal: 4, paddingBottom: 4, fontFamily: font.body.bold }}>
              {g.title}
            </Text>
            {ALARM_TYPES.filter((a) => a.cat === g.cat).map((a) => {
              const Icon = a.icon;
              const on = enabled[a.id] ?? true;
              return (
                <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: t.line }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: hexA(a.color, 0.16) }}>
                    <Icon size={17} color={a.color} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: t.text, fontFamily: font.body.semibold }}>{a.label}</Text>
                  <Toggle t={t} on={on} set={(v) => onToggle(a.id, v)} />
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
