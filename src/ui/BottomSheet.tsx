import { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "../theme/tokens";

type Props = {
  t: Theme;
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Feuille modale ancrée en bas (base des sheets maquette). */
export function BottomSheet({ t, visible, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: t.glassSolid,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: t.border,
            paddingHorizontal: 18,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 22) + 4,
          }}
        >
          <View style={{ width: 38, height: 5, borderRadius: 999, backgroundColor: t.sub, opacity: 0.4, alignSelf: "center", marginBottom: 14 }} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
