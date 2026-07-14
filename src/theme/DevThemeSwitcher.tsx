/**
 * OUTIL INTERNE — sélecteur de variante visuelle (dev/preview ONLY).
 *
 * N'est monté QUE derrière `__DEV__` (voir App.tsx). Jamais dans un build
 * de production client. Chrome volontairement neutre (couleurs fixes) pour
 * rester lisible par-dessus n'importe quelle variante prévisualisée.
 *
 * Retirable : supprimer ce fichier + le bloc `{__DEV__ && <DevThemeSwitcher/>}`
 * dans App.tsx. Aucun autre code ne l'importe.
 */
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./ThemeProvider";

export function DevThemeSwitcher() {
  const insets = useSafeAreaInsets();
  const { variantId, setVariant, variants } = useTheme();
  const [open, setOpen] = useState(false);

  const activeName = variantId ? variants.find((v) => v.id === variantId)?.name : "Prod";

  return (
    <>
      {/* FAB flottant bas-droite */}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          position: "absolute",
          right: 12,
          bottom: insets.bottom + 78,
          backgroundColor: "rgba(10,12,20,0.92)",
          borderColor: "rgba(255,255,255,0.22)",
          borderWidth: 1,
          borderRadius: 999,
          paddingVertical: 8,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          zIndex: 9999,
        }}
      >
        <Text style={{ fontSize: 14 }}>🎨</Text>
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{activeName}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: "78%",
            backgroundColor: "#0B0E16",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderColor: "rgba(255,255,255,0.14)",
            borderWidth: 1,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>Variantes visuelles</Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 }}>
              Outil interne — non visible en prod
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 4, gap: 8 }}>
            <Row
              name="Prod (défaut)"
              tagline="Thème de production — aucune surcharge"
              swatches={["#06080F", "#D4FF17", "#FFFFFF"]}
              active={variantId === null}
              onPress={() => {
                setVariant(null);
                setOpen(false);
              }}
            />
            {variants.map((v) => (
              <Row
                key={v.id}
                name={v.name}
                tagline={v.tagline}
                swatches={[v.colors.bg, v.colors.accent, v.colors.text]}
                active={variantId === v.id}
                onPress={() => {
                  setVariant(v.id);
                  setOpen(false);
                }}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Row({
  name,
  tagline,
  swatches,
  active,
  onPress,
}: {
  name: string;
  tagline: string;
  swatches: string[];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
        borderColor: active ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.10)",
        borderWidth: 1,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {swatches.map((c, i) => (
          <View
            key={i}
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              backgroundColor: c,
              borderColor: "rgba(255,255,255,0.25)",
              borderWidth: 1,
              marginLeft: i === 0 ? 0 : -5,
            }}
          />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>{name}</Text>
        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11.5, marginTop: 1 }}>{tagline}</Text>
      </View>
      {active ? <Text style={{ color: "#8FE388", fontSize: 16, fontWeight: "800" }}>✓</Text> : null}
    </Pressable>
  );
}
