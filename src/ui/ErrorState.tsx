import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RotateCw } from "lucide-react-native";
import { Theme } from "../theme/tokens";
import { font } from "../theme/fonts";

type Props = {
  t: Theme;
  /** Message déjà TRADUIT (via `toUserMessage`). Jamais d'erreur brute. */
  message: string;
  /** Si fourni, affiche un bouton « Réessayer » pour ne pas laisser l'utilisateur bloqué. */
  onRetry?: () => void;
};

/**
 * État d'erreur bloquant réutilisable : pictogramme + message clair + action
 * « Réessayer » optionnelle (handoff : ne jamais laisser un écran vide sans issue).
 * §5 : le bouton passe en spinner inline le temps de la nouvelle tentative
 * (l'indicateur retombe dès que le message change — succès = démontage, échec = re-render).
 */
export function ErrorState({ t, message, onRetry }: Props) {
  const { t: tr } = useTranslation();
  const [busy, setBusy] = useState(false);

  // Réinitialise le spinner à chaque nouveau message (nouvelle tentative résolue).
  useEffect(() => setBusy(false), [message]);

  return (
    <View style={{ alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 28 }}>
      <AlertTriangle size={26} color={t.sub} />
      <Text style={{ color: t.sub, fontSize: 13.5, lineHeight: 20, textAlign: "center", fontFamily: font.body.regular }}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={() => {
            setBusy(true);
            onRetry();
          }}
          disabled={busy}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: t.glass, borderWidth: 1, borderColor: t.border, opacity: busy ? 0.7 : 1 }}
        >
          {busy ? <ActivityIndicator size="small" color={t.text} /> : <RotateCw size={15} color={t.text} />}
          <Text style={{ fontSize: 14, color: t.text, fontFamily: font.body.bold }}>{tr("common.retry")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
