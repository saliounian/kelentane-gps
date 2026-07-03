import type { TFunction } from "i18next";

export type Units = "km" | "mi";
const KM_TO_MI = 0.621371;

/** Convertit une valeur en km selon l'unité choisie (arrondie). */
export function convKm(km: number, units: Units): number {
  return units === "mi" ? Math.round(km * KM_TO_MI) : Math.round(km);
}
/** Convertit une vitesse km/h selon l'unité choisie (arrondie). */
export function convSpeed(kmh: number, units: Units): number {
  return units === "mi" ? Math.round(kmh * KM_TO_MI) : Math.round(kmh);
}
export function speedUnit(units: Units, t: TFunction): string {
  return t(units === "mi" ? "units.mph" : "units.kmh");
}
export function distUnit(units: Units, t: TFunction): string {
  return t(units === "mi" ? "units.mi" : "units.km");
}
