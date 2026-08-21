import { Text, View } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";
import { font } from "../theme/fonts";

/**
 * Logo officiel Kelentane GPS — reconstruit en VECTORIEL (react-native-svg) pour un
 * rendu net à toutes les tailles et une adaptation au thème (le wordmark suit la
 * couleur du texte). Le glyphe = « K » (spine + bras haut + jambe basse) surchargé
 * d'une flèche/curseur de navigation lime.
 *
 * ⚠️ PLACEHOLDER FIDÈLE : géométrie reconstruite d'après les fichiers client. À
 * remplacer par les exports officiels du client avant soumission aux stores si une
 * correspondance pixel-perfect est requise (voir assets/brand/).
 */

export const PIN_DEEP = "#0A5C42"; // vert Pin Profond — fond conteneur / K plein
export const BRAND_LIME = "#B4E82A"; // lime — flèche/curseur de navigation

// Glyphe K + flèche dans un repère 100×100. `glyph` = couleur des trois traits du K
// (blanc sur fond vert, vert Pin sur fond clair/transparent).
function KPaths({ glyph }: { glyph: string }) {
  return (
    <>
      {/* Spine (montant gauche) + bras haut + jambe basse, capuchons arrondis. */}
      <Line x1={33} y1={22} x2={33} y2={78} stroke={glyph} strokeWidth={13} strokeLinecap="round" />
      <Line x1={35} y1={50} x2={73} y2={23} stroke={glyph} strokeWidth={13} strokeLinecap="round" />
      <Line x1={39} y1={52} x2={73} y2={78} stroke={glyph} strokeWidth={13} strokeLinecap="round" />
      {/* Flèche/curseur de navigation, pointe vers le bas-gauche (coins arrondis). */}
      <Path d="M47 69 L70 43 L69 66 Z" fill={BRAND_LIME} stroke={BRAND_LIME} strokeWidth={5} strokeLinejoin="round" />
    </>
  );
}

type GlyphProps = {
  size?: number;
  /** true = conteneur carré arrondi vert + K blanc (icône d'app). false = glyphe seul. */
  framed?: boolean;
  /** couleur du K quand non encadré (défaut vert Pin). Ignoré si `framed`. */
  glyphColor?: string;
};

/** Marque seule (glyphe). Encadrée = look icône d'app ; nue = usage sur fond variable. */
export function BrandGlyph({ size = 38, framed = true, glyphColor = PIN_DEEP }: GlyphProps) {
  const glyph = framed ? "#FFFFFF" : glyphColor;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {framed ? <Rect x={2} y={2} width={96} height={96} rx={24} fill={PIN_DEEP} /> : null}
      <KPaths glyph={glyph} />
    </Svg>
  );
}

type LockupProps = {
  /** hauteur de la marque ; le wordmark est dimensionné proportionnellement. */
  size?: number;
  /** couleur du wordmark « KELENTANE GPS » (thème : text). Défaut sombre. */
  wordColor?: string;
  framed?: boolean;
};

const Wordmark = ({ height, color }: { height: number; color: string }) => (
  <Text
    style={{
      fontFamily: font.display.black,
      fontSize: height,
      lineHeight: height * 1.02,
      letterSpacing: -0.5,
      color,
    }}
    numberOfLines={1}
  >
    KELENTANE GPS
  </Text>
);

/** Lockup HORIZONTAL : marque + wordmark côte à côte (en-tête d'app). */
export function BrandLockupH({ size = 40, wordColor = "#101513", framed = true }: LockupProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.28 }}>
      <BrandGlyph size={size} framed={framed} />
      <Wordmark height={size * 0.5} color={wordColor} />
    </View>
  );
}

/** Lockup VERTICAL : marque au-dessus, wordmark en dessous (splash / chargement). */
export function BrandLockupV({ size = 112, wordColor = "#101513", framed = true }: LockupProps) {
  return (
    <View style={{ alignItems: "center", gap: size * 0.18 }}>
      <BrandGlyph size={size} framed={framed} />
      <Wordmark height={size * 0.24} color={wordColor} />
    </View>
  );
}
