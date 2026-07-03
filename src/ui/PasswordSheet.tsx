import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AlertTriangle, KeyRound, Lock, Power } from "lucide-react-native";
import { ACCENT, ALERT, hexA, LIME_ON, PARKED, Theme } from "../theme/tokens";
import { font } from "../theme/fonts";
import { BottomSheet } from "./BottomSheet";
import { Field } from "./Field";

type Props = {
  t: Theme;
  visible: boolean;
  title: string;
  confirmLabel: string;
  onConfirm: (password: string) => void;
  onClose: () => void;
  danger?: boolean;
  note?: string | null;
};

/**
 * Confirmation par mot de passe (commandes sensibles, suppression).
 * Maquette : `PasswordSheet`. La vérif réelle est côté API (stub étape 4).
 */
export function PasswordSheet({ t, visible, title, confirmLabel, onConfirm, onClose, danger, note }: Props) {
  const { t: tr } = useTranslation();
  const [pwd, setPwd] = useState("");
  const c = danger ? ALERT : ACCENT;

  const confirm = () => {
    onConfirm(pwd);
    setPwd("");
  };

  return (
    <BottomSheet t={t} visible={visible} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: hexA(c, 0.16) }}>
          {danger ? <Lock size={20} color={c} /> : <Power size={20} color={c} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, color: t.text, fontFamily: font.body.bold }}>{title}</Text>
          <Text style={{ fontSize: 12, color: t.sub, fontFamily: font.body.regular }}>
            {tr("pwd.confirmAccount")}
          </Text>
        </View>
      </View>

      {note ? (
        <View style={{ flexDirection: "row", gap: 8, marginVertical: 10, padding: 10, borderRadius: 12, backgroundColor: hexA(PARKED, 0.14) }}>
          <AlertTriangle size={16} color={PARKED} />
          <Text style={{ flex: 1, fontSize: 12, color: t.text, fontFamily: font.body.regular, lineHeight: 18 }}>{note}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 8 }}>
        <Field t={t} label={tr("pwd.accountPwd")} icon={KeyRound} placeholder="••••••" secure value={pwd} onChangeText={setPwd} />
      </View>

      <Pressable
        onPress={confirm}
        style={{
          borderRadius: 16,
          paddingVertical: 14,
          alignItems: "center",
          marginTop: 4,
          backgroundColor: c,
        }}
      >
        <Text style={{ fontSize: 15, color: danger ? "#fff" : LIME_ON, fontFamily: font.body.bold }}>{confirmLabel}</Text>
      </Pressable>
    </BottomSheet>
  );
}
