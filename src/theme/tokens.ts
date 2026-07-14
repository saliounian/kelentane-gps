/**
 * Kelentane GPS — design tokens (source de vérité : maquette + handoff Annexe A).
 *
 * RÈGLE ABSOLUE : le lime #D4FF17 est réservé marque / action / sélection.
 * Il ne code JAMAIS un statut véhicule. Le statut se lit via
 * ONLINE / PARKED / OFFLINE / ALERT (anneau, pastille, StatusPill).
 */

/* ---------------------------------------------------------------- MARQUE + STATUTS
 * NOTE VARIANTES (dev/preview) : ces tokens sont `let` (au lieu de `const`) pour
 * pouvoir être remplacés en place par __applyVariant. Grâce aux « live bindings »
 * ESM, les écrans qui les importent directement voient la nouvelle valeur au
 * re-render. En prod (aucune variante), ils gardent EXACTEMENT les valeurs ci-dessous
 * — voir DEFAULTS / __applyVariant(null). */
export let LIME = "#D4FF17"; // accent marque — action / identité / sélection
export let LIME_ON = "#15210A"; // texte foncé posé SUR le lime
export let ACCENT = LIME;

export let ONLINE = "#36D399"; // teal — en ligne / en mouvement
export let PARKED = "#FFB14E"; // stationné
export let OFFLINE = "#8E8E93"; // hors ligne
export let ALERT = "#FF5C5C"; // alarme / anomalie

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
  accent: string;
  glass: string;
  glassSolid: string;
  border: string;
  line: string;
  map1: string;
  map2: string;
};

/** theme(dark) — tokens exacts Annexe A.2. En clair, `accent` bascule sur un
 *  chartreuse foncé (#4F6B00) pour rester lisible ; le lime pur reste réservé
 *  aux fonds d'action (boutons) avec LIME_ON en texte. */
export function theme(dark: boolean): Theme {
  // [VARIANTES — dev only] Si une variante est active, ses couleurs priment.
  // Sans variante (_variantTheme === null), comportement de prod inchangé.
  if (_variantTheme) return _variantTheme;
  return dark
    ? {
        bg: "#06080F",
        text: "#FFFFFF",
        sub: "rgba(255,255,255,0.58)",
        accent: "#D4FF17",
        glass: "rgba(255,255,255,0.07)",
        glassSolid: "rgba(20,24,34,0.78)",
        border: "rgba(255,255,255,0.14)",
        line: "rgba(255,255,255,0.09)",
        map1: "#0B1424",
        map2: "#06080F",
      }
    : {
        bg: "#DFE7F0",
        text: "#0A0C14",
        sub: "rgba(10,12,20,0.55)",
        accent: "#4F6B00",
        glass: "rgba(255,255,255,0.55)",
        glassSolid: "rgba(255,255,255,0.86)",
        border: "rgba(255,255,255,0.85)",
        line: "rgba(10,12,20,0.08)",
        map1: "#DFE7F0",
        map2: "#CFDBE8",
      };
}

/* ---------------------------------------------------------------- VARIANTES (dev only)
 * Outil interne de comparaison visuelle. Remplace en place les tokens marque/statut
 * et le thème renvoyé par theme(). `null` restaure la prod. Retirable : supprimer ce
 * bloc + le garde-fou dans theme() + le dossier variants/ + le mount __DEV__. */
const DEFAULTS = {
  lime: "#D4FF17",
  limeOn: "#15210A",
  online: "#36D399",
  parked: "#FFB14E",
  offline: "#8E8E93",
  alert: "#FF5C5C",
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
