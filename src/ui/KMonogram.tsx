import { BrandGlyph } from "./BrandLogo";

/**
 * Marque Kelentane encadrée (glyphe K + flèche lime sur carré vert Pin). Conserve
 * l'API historique `{ size }` : toutes les instances (en-tête carte, écran auth,
 * splash de session) basculent d'un coup sur le nouveau logo vectoriel.
 * Maquette : `KMonogram`.
 */
export function KMonogram({ size = 38 }: { size?: number }) {
  return <BrandGlyph size={size} framed />;
}
