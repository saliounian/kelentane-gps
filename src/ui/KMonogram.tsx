import { Image } from "react-native";

/**
 * Marque Kelentane encadrée — icône carrée officielle du client (fichier raster
 * réel, assets/brand/icon.png). Conserve l'API historique `{ size }` : toutes les
 * instances (en-tête carte, écran auth) basculent d'un coup sur le vrai logo.
 * Maquette : `KMonogram`.
 */
export function KMonogram({ size = 38 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/brand/icon.png")}
      style={{ width: size, height: size, borderRadius: size * 0.32 }}
      resizeMode="contain"
    />
  );
}
