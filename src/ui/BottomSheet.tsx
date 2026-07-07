import { ReactNode } from "react";
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "../theme/tokens";

type Props = {
  t: Theme;
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Feuille modale ancrée en bas (base des sheets maquette).
 *
 * Ancrage bas conservé (maquette fait autorité), mais :
 * - `Modal` natif : rend au-dessus de la tab bar → aucun chevauchement possible.
 * - `KeyboardAvoidingView` : la feuille remonte au-dessus du clavier au lieu
 *   d'être masquée (saisie mot de passe, nom de zone, plage de dates…).
 * - hauteur plafonnée + `ScrollView` interne : le contenu long reste
 *   entièrement atteignable, aucun bouton ne se retrouve caché.
 */
export function BottomSheet({ t, visible, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const maxSheet = Dimensions.get("window").height * 0.88;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: maxSheet,
              backgroundColor: t.glassSolid,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderWidth: 1,
              borderColor: t.border,
              paddingTop: 10,
            }}
          >
            <View style={{ width: 38, height: 5, borderRadius: 999, backgroundColor: t.sub, opacity: 0.4, alignSelf: "center", marginBottom: 14 }} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: Math.max(insets.bottom, 22) + 4 }}
            >
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
