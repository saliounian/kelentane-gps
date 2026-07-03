import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
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

const GROUPS: { cat: AlarmCat; key: string }[] = [
  { cat: "event", key: "alarms.groupEvent" },
  { cat: "anomaly", key: "alarms.groupAnomaly" },
];

/** Réglages par type d'alarme (maquette AlarmSettingsSheet). */
export function AlarmSettingsSheet({ t, visible, enabled, onToggle, onClose }: Props) {
  const { t: tr } = useTranslation();
  return (
    <BottomSheet t={t} visible={visible} onClose={onClose}>
      <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold, paddingHorizontal: 4 }}>
        {tr("alarms.settingsTitle")}
      </Text>
      <Text style={{ fontSize: 12, color: t.sub, paddingHorizontal: 4, paddingBottom: 6, fontFamily: font.body.regular }}>
        {tr("alarms.settingsDesc")}
      </Text>
      <ScrollView style={{ maxHeight: 460 }}>
        {GROUPS.map((g) => (
          <View key={g.cat}>
            <Text style={{ fontSize: 12, color: t.sub, paddingTop: 10, paddingHorizontal: 4, paddingBottom: 4, fontFamily: font.body.bold }}>
              {tr(g.key)}
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
