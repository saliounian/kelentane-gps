/**
 * Kelentane GPS — design tokens. Charte v2 « Pin Profond + Charbon » (clair).
 *
 * Signature = vert Pin (700 #0A5C42) pour l'action/marque. Contrairement à la v1
 * (lime), le vert code AUSSI le statut « en ligne » (Pin 500 #159C6A) — assumé :
 * le produit parle de « connecté » en vert. Les deux nuances (700 accent / 500
 * statut) restent distinctes. `LIME`/`LIME_ON` gardent leur nom (compat imports)
 * mais portent désormais le vert Pin / le texte blanc posé dessus.
 */

/* ---------------------------------------------------------------- MARQUE + STATUTS
 * NOTE VARIANTES (dev/preview) : ces tokens sont `let` (au lieu de `const`) pour
 * pouvoir être remplacés en place par __applyVariant. Grâce aux « live bindings »
 * ESM, les écrans qui les importent directement voient la nouvelle valeur au
 * re-render. En prod (aucune variante), ils gardent EXACTEMENT les valeurs ci-dessous
 * — voir DEFAULTS / __applyVariant(null). */
export let LIME = "#0A5C42"; // accent marque — Pin 700 (action / identité / sélection)
export let LIME_ON = "#FFFFFF"; // texte BLANC posé sur l'accent vert plein
export let ACCENT = LIME;

export let ONLINE = "#159C6A"; // Pin 500 — en ligne / en mouvement
// §3 : teinte CLAIRE de marque pour les tracés de suivi/trajectoire (dérivée du Pin
// #159C6A, éclaircie). Const : lisible sur clair ET sombre, indépendante des variantes.
// (pas de dégradé natif : `strokeColors` en dégradé ≈ iOS seul sur react-native-maps.)
export const TRACK = "#4FD6A0";
export let PARKED = "#B8862E"; // ambre doré — stationné / attention
export let OFFLINE = "#9AA39D"; // charbon 300 — hors ligne
export let ALERT = "#B23B2E"; // terracotta brique — alarme / anomalie

/* Statut véhicule (métier) */
export type VehicleStatus = "moving" | "online" | "parked" | "offline";

/* Libellés statut (FR) */
export const STATUS_LABEL: Record<VehicleStatus, string> = {
  moving: "En mouvement",
  online: "En ligne",
  parked: "Stationné",
  offline: "Hors ligne",
};

/** Couleur dérivée du statut (jamais le lime). */
export function statusColor(status: VehicleStatus): string {
  switch (status) {
    case "moving":
    case "online":
      return ONLINE;
    case "parked":
      return PARKED;
    case "offline":
      return OFFLINE;
  }
}

/* ---------------------------------------------------------------- CONFIG FRAÎCHEUR
 * Externalisé (dette §16 : seuils codés en dur dans freshColor de la maquette). */
export const FRESHNESS = {
  onlineMaxMs: 10 * 60 * 1000, // < 10 min → ONLINE
  parkedMaxMs: 24 * 60 * 60 * 1000, // < 24 h → PARKED, au-delà → ALERT
};

/* ---------------------------------------------------------------- THÈME */
export type Theme = {
  bg: string;
  text: string;
  sub: string;
  /** Accent PLEIN : fond de bouton, badge, sélection, barre de progression (lime pur). */
  accent: string;
  /** Accent TEXTE/ICÔNE posé directement sur fond clair : lime foncé lisible (WCAG AA). */
  accentMuted: string;
  glass: string;
  glassSolid: string;
  border: string;
  line: string;
  map1: string;
  map2: string;
};

/** Thème de PRODUCTION — charte v2 « Pin Profond + Charbon », décliné CLAIR + SOMBRE.
 *  Constante entre les deux modes : `accent` = Pin 700 #0A5C42 pour les FONDS pleins
 *  (bouton/badge) + texte BLANC (LIME_ON) → contraste élevé dans les deux thèmes.
 *  Adapté au fond (charte règle 03) : `accentMuted` = accent en TEXTE/ICÔNE sur le
 *  fond = Pin 700 sur clair (foncé sur Fog), Pin 500 #159C6A sur sombre (Pin 700
 *  s'écraserait sur le Charbon 900). Statuts identiques dans les deux modes. */
export function theme(dark = false): Theme {
  // [VARIANTES — dev only] Si une variante est active, ses couleurs priment.
  if (_variantTheme) return _variantTheme;
  return dark
    ? {
        bg: "#101513", // Charbon 900
        text: "#FFFFFF", // Paper
        sub: "#9AA39D", // Charbon 300
        accent: "#0A5C42", // Pin 700 (fond bouton, texte blanc)
        accentMuted: "#159C6A", // Pin 500 (texte/icône lisible sur sombre)
        glass: "rgba(255,255,255,0.06)",
        glassSolid: "rgba(42,48,45,0.92)", // surface sombre alt. (Charbon 700)
        border: "#2A302D", // Charbon 700
        line: "rgba(255,255,255,0.08)",
        map1: "#16201B",
        map2: "#101513",
      }
    : {
        bg: "#F4F6F4", // Fog
        text: "#101513", // Charbon 900
        sub: "#5C655F", // Charbon 500
        accent: "#0A5C42", // Pin 700
        accentMuted: "#0A5C42", // Pin 700 (texte/icône sur clair)
        glass: "rgba(255,255,255,0.65)",
        glassSolid: "rgba(255,255,255,0.92)", // Paper
        border: "#DFE4E1", // Charbon 100
        line: "#E2E7E3",
        map1: "#EAEFEA",
        map2: "#DDE4DE",
      };
}

/* ---------------------------------------------------------------- VARIANTES (dev only)
 * Outil interne de comparaison visuelle. Remplace en place les tokens marque/statut
 * et le thème renvoyé par theme(). `null` restaure la prod. Retirable : supprimer ce
 * bloc + le garde-fou dans theme() + le dossier variants/ + le mount __DEV__. */
const DEFAULTS = {
  lime: "#0A5C42",
  limeOn: "#FFFFFF",
  online: "#159C6A",
  parked: "#B8862E",
  offline: "#9AA39D",
  alert: "#B23B2E",
};

let _variantTheme: Theme | null = null;

/** Payload minimal d'une variante (évite l'import circulaire de Variant). */
export type VariantPayload = {
  theme: Theme;
  accent: string;
  accentText: string;
  online: string;
  parked: string;
  offline: string;
  alert: string;
};

/** [dev only] Applique/retire une variante. Mute les live bindings + le thème actif. */
export function __applyVariant(v: VariantPayload | null): void {
  if (v) {
    _variantTheme = v.theme;
    LIME = v.accent;
    ACCENT = v.accent;
    LIME_ON = v.accentText;
    ONLINE = v.online;
    PARKED = v.parked;
    OFFLINE = v.offline;
    ALERT = v.alert;
  } else {
    _variantTheme = null;
    LIME = DEFAULTS.lime;
    ACCENT = DEFAULTS.lime;
    LIME_ON = DEFAULTS.limeOn;
    ONLINE = DEFAULTS.online;
    PARKED = DEFAULTS.parked;
    OFFLINE = DEFAULTS.offline;
    ALERT = DEFAULTS.alert;
  }
}

/* ---------------------------------------------------------------- HELPERS */
/** Teinte une couleur hex (#RGB ou #RRGGBB) avec opacité → rgba(). */
export function hexA(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Style d'overlay pour une surface glass (à poser au-dessus d'un BlurView). */
export function glassStyle(t: Theme) {
  return {
    backgroundColor: t.glass,
    borderColor: t.border,
    borderWidth: 1,
  } as const;
}

/** Couleur de fraîcheur d'un dernier point (répliqué de freshColor, seuils config). */
export function freshColor(lastSeen: Date, now: Date = new Date()): string {
  const ms = now.getTime() - lastSeen.getTime();
  if (ms < FRESHNESS.onlineMaxMs) return ONLINE;
  if (ms < FRESHNESS.parkedMaxMs) return PARKED;
  return ALERT;
}
