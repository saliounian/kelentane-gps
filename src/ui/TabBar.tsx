import { Pressable, Text, View } from "react-native";
import { BarChart3, Bell, Home, List, User } from "lucide-react-native";
import { ACCENT, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import type { LucideIcon, TabId } from "../types/models";

const TABS: { id: TabId; icon: LucideIcon; label: string }[] = [
  { id: "map", icon: Home, label: "Carte" },
  { id: "list", icon: List, label: "Véhicules" },
  { id: "alarm", icon: Bell, label: "Alarmes" },
  { id: "stats", icon: BarChart3, label: "Stats" },
  { id: "me", icon: User, label: "Profil" },
];

type Props = {
  t: Theme;
  dark: boolean;
  active: TabId;
  onSelect: (id: TabId) => void;
};

/**
 * Barre d'onglets flottante en verre (5 onglets).
 * Couleur active = t.accent. Maquette : `TabBar`.
 * NB: le fond blur réel viendra via <Glass> au montage écran ; ici surface
 * translucide simple pour rester autonome.
 */
export function TabBar({ t, dark, active, onSelect }: Props) {
  return (
    <View
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        borderRadius: 26,
        paddingVertical: 8,
        paddingHorizontal: 6,
        flexDirection: "row",
        justifyContent: "space-around",
        backgroundColor: t.glassSolid,
        borderWidth: 1,
        borderColor: t.border,
        shadowColor: "#000",
        shadowOpacity: dark ? 0.5 : 0.25,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 12 },
      }}
    >
      {TABS.map((tab) => {
        const on = active === tab.id;
        const Icon = tab.icon;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 }}
          >
            <Icon size={21} color={on ? ACCENT : t.sub} strokeWidth={on ? 2.4 : 2} />
            <Text
              style={{
                fontSize: 9.5,
                color: on ? ACCENT : t.sub,
                fontFamily: on ? font.body.bold : font.body.medium,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
