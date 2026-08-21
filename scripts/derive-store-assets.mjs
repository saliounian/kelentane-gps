/**
 * Génère les assets STORE (noms ASCII attendus par app.json) À PARTIR DES VRAIS
 * FICHIERS CLIENT déposés dans assets/brand/ (source de vérité). Opérations RASTER
 * uniquement (resize / pad / extraction d'alpha) — AUCUNE reconstruction vectorielle.
 * Remplace l'ancien gen-brand.mjs (qui redessinait le logo en SVG).
 *
 *   node scripts/derive-store-assets.mjs
 */
import sharp from "sharp";
const B = "assets/brand/";
const SQUARE = B + "favicone.png";              // carré vert plein-bord opaque
const GLYPH = B + "icon fond sombre png.png";    // glyphe K seul, fond transparent

// Silhouette blanche (forme du glyphe) sur transparent — pour icône notif Android
// (rendue en blanc par le système) et couche monochrome adaptive.
async function silhouette(src, size, pad) {
  const inner = size - pad * 2;
  const shaped = sharp(src)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const alpha = await shaped.clone().ensureAlpha().extractChannel(3).toColourspace("b-w").png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(alpha)
    .png();
}

async function main() {
  await sharp(SQUARE).resize(1024, 1024, { fit: "cover" }).png().toFile(B + "icon.png");
  await sharp(SQUARE).resize(1024, 1024, { fit: "cover" }).png().toFile(B + "splash-icon.png");
  await sharp(SQUARE).resize(196, 196, { fit: "cover" }).png().toFile(B + "favicon.png");
  // Foreground adaptive : glyphe centré dans la zone de sécurité (~68 %), transparent.
  await sharp(GLYPH)
    .resize(700, 700, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 162, bottom: 162, left: 162, right: 162, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(B + "adaptive-foreground.png");
  await (await silhouette(GLYPH, 1024, 130)).toFile(B + "adaptive-monochrome.png");
  await (await silhouette(GLYPH, 256, 40)).toFile(B + "notification-icon.png");

  // Copie ASCII (require() ne gère pas les espaces/apostrophes) du lockup vertical
  // réel pour l'écran de chargement in-app. Détouré (trim) puis borné en largeur.
  await sharp(B + "Logo d'affichage d'ouverture.png")
    .trim()
    .resize({ width: 768, withoutEnlargement: true })
    .png()
    .toFile(B + "lockup-vertical.png");

  console.log("store assets derived from client sources");
}
main();
