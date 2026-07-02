import { useState } from "react";
import {
  ScrollView,
  StatusBar as RNStatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import {
  ACCENT,
  ALERT,
  hexA,
  LIME,
  LIME_ON,
  OFFLINE,
  ONLINE,
  PARKED,
  STATUS_LABEL,
  theme,
} from "./src/theme/tokens";
import { DISPLAY, font, MONO, useAppFonts } from "./src/theme/fonts";

/**
 * Étape 0 — écran de démonstration du design system.
 * Prouve : tokens couleur, thème dark/light, 3 familles de police,
 * surface glass (BlurView), et la règle « lime = marque/action, jamais statut ».
 * Sera remplacé par le vrai chrome de l'app à l'étape 3.
 */
export default function App() {
  const [dark, setDark] = useState(true);
  const [fontsLoaded] = useAppFonts();
  const t = theme(dark);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: dark ? "#06080F" : "#DFE7F0" }} />;
  }

  const statuses: { key: string; color: string }[] = [
    { key: "online", color: ONLINE },
    { key: "parked", color: PARKED },
    { key: "offline", color: OFFLINE },
    { key: "moving", color: ONLINE },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: (RNStatusBar.currentHeight ?? 44) + 16,
          paddingHorizontal: 18,
          paddingBottom: 40,
          gap: 18,
        }}
      >
        {/* Marque : monogramme K + wordmark */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: ACCENT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: LIME_ON, fontSize: 26, fontFamily: font.display.black }}>K</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 26, fontFamily: DISPLAY, letterSpacing: -0.5 }}>
              kelentane
            </Text>
            <Text style={{ color: t.sub, fontSize: 12, fontFamily: font.body.regular }}>
              Design system · Étape 0
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setDark((d) => !d)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: t.glass,
            }}
          >
            <Text style={{ color: t.text, fontSize: 12, fontFamily: font.body.semibold }}>
              {dark ? "Sombre" : "Clair"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Typographie */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.sub, fontSize: 12, fontFamily: font.body.semibold }}>
            TYPOGRAPHIE
          </Text>
          <Text style={{ color: t.text, fontSize: 34, fontFamily: font.display.black, letterSpacing: -1 }}>
            84 210 km
          </Text>
          <Text style={{ color: t.text, fontSize: 15, fontFamily: font.body.regular, lineHeight: 22 }}>
            IBM Plex Sans — corps de texte. Réseau parfois faible, français par défaut.
          </Text>
          <Text style={{ color: t.sub, fontSize: 13, fontFamily: MONO }}>
            IMEI 356 789 123 456 781 · GT06N
          </Text>
        </View>

        {/* Statuts — le lime n'apparaît JAMAIS ici */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: t.sub, fontSize: 12, fontFamily: font.body.semibold }}>
            STATUTS (jamais lime)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {statuses.map((s, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: hexA(s.color, 0.16),
                }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.color }} />
                <Text style={{ color: s.color, fontSize: 12, fontFamily: font.body.bold }}>
                  {STATUS_LABEL[s.key]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Surface glass */}
        <View style={{ borderRadius: 22, overflow: "hidden" }}>
          <BlurView
            intensity={dark ? 30 : 40}
            tint={dark ? "dark" : "light"}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              borderRadius: 22,
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: t.glass,
              padding: 16,
              gap: 12,
            }}
          >
            <Text style={{ color: t.text, fontSize: 16, fontFamily: font.display.bold }}>
              Peugeot Expert
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { label: "Vitesse", value: "47", unit: "km/h" },
                { label: "Batterie", value: "80", unit: "%" },
                { label: "Tension", value: "11", unit: "V" },
              ].map((m, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    borderRadius: 13,
                    borderWidth: 1,
                    borderColor: t.line,
                    backgroundColor: t.glass,
                    paddingVertical: 9,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: t.sub, fontSize: 10, fontFamily: font.body.regular }}>
                    {m.label}
                  </Text>
                  <Text style={{ color: t.text, fontSize: 19, fontFamily: font.display.extrabold }}>
                    {m.value}
                    <Text style={{ color: t.sub, fontSize: 10 }}> {m.unit}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Action de marque — SEUL usage légitime du lime plein */}
        <TouchableOpacity
          style={{
            backgroundColor: LIME,
            borderRadius: 16,
            paddingVertical: 14,
            alignItems: "center",
            shadowColor: LIME,
            shadowOpacity: 0.45,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <Text style={{ color: LIME_ON, fontSize: 15, fontFamily: font.body.bold }}>
            Action de marque
          </Text>
        </TouchableOpacity>

        {/* Rappel ALERT (danger, pas un statut d'ambiance) */}
        <Text style={{ color: ALERT, fontSize: 12, fontFamily: font.body.medium, textAlign: "center" }}>
          ALERT #FF5C5C — réservé alarme / anomalie
        </Text>
      </ScrollView>
    </View>
  );
}
