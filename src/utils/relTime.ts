/**
 * §2 — Âge relatif d'une donnée, TRADUIT (fr/en/ar). Un seul helper pour tous les
 * écrans : sous-texte du badge « Pas à jour » (carte), ligne « Mise à jour »
 * (Détail), ancienneté de la télémétrie. Aucune chaîne codée en dur.
 */
import i18n from "../i18n";

/** « à l'instant » / « il y a 12 min » / « il y a 3 h » / « hier à 14 h » / « le 12/07 à 9 h ». */
export function relAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const ts = d.getTime();
  if (Number.isNaN(ts)) return "—";
  const now = Date.now();
  const min = Math.floor((now - ts) / 60000);
  if (min < 1) return i18n.t("time.now");
  if (min < 60) return i18n.t("time.minAgo", { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return i18n.t("time.hourAgo", { count: h });

  const hour = d.getHours();
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const sameDay = d.getDate() === yest.getDate() && d.getMonth() === yest.getMonth() && d.getFullYear() === yest.getFullYear();
  if (sameDay) return i18n.t("time.yesterdayAt", { hour });
  const p = (n: number) => String(n).padStart(2, "0");
  return i18n.t("time.onDateAt", { date: `${p(d.getDate())}/${p(d.getMonth() + 1)}`, hour });
}
