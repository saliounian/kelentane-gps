import type { ReactElement } from "react";
import { Image } from "react-native";
import { VEHICLE_ASSETS } from "./vehicleAssets";
import type { VehicleVM } from "../types/vehicle";

/** Composant d'icône véhicule (art PNG coloré). `color` ignoré : l'art a sa
 *  propre palette (le statut se lit via l'anneau/la pastille, jamais l'icône). */
export type VehicleIconComponent = (props: { size?: number; color?: string }) => ReactElement;

const cache = new Map<string, VehicleIconComponent>();

function iconFor(key: string): VehicleIconComponent {
  const cached = cache.get(key);
  if (cached) return cached;
  const source = VEHICLE_ASSETS[key];
  const Comp: VehicleIconComponent = ({ size = 24 }) => (
    <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
  );
  cache.set(key, Comp);
  return Comp;
}

/** Icônes disponibles (clé → composant). Maquette : VEH_ICONS. */
export const VEH_ICONS: Record<string, VehicleIconComponent> = Object.fromEntries(
  Object.keys(VEHICLE_ASSETS).map((k) => [k, iconFor(k)]),
);

/** Ordre d'affichage du sélecteur (maquette VEH_ICON_LIST). */
export const VEH_ICON_LIST = [
  "car",
  "suv",
  "van",
  "pickup",
  "truck",
  "bus",
  "moto",
  "taxi",
  "ambulance",
  "sport",
  "racingR",
  "racingY",
] as const;

/** Libellés FR (maquette VEH_ICON_LABELS). */
export const VEH_ICON_LABELS: Record<string, string> = {
  car: "Voiture",
  suv: "SUV",
  van: "Fourgon",
  pickup: "Pick-up",
  truck: "Camion",
  bus: "Bus",
  moto: "Moto",
  taxi: "Taxi",
  ambulance: "Ambulance",
  sport: "Sport",
  racingR: "Sport rouge",
  racingY: "Sport jaune",
};

/** Icône par défaut dérivée du type véhicule (dette §16 : défaut aligné sur type). */
const TYPE_DEFAULT: Record<string, string> = {
  car: "car",
  van: "van",
  truck: "truck",
  bus: "bus",
  moto: "moto",
  taxi: "taxi",
  ambulance: "ambulance",
  other: "car",
};

/** Icône effective d'un véhicule : clé choisie, sinon défaut selon le type. */
export function iconForVehicle(v: Pick<VehicleVM, "iconKey" | "type">): VehicleIconComponent {
  if (v.iconKey && VEH_ICONS[v.iconKey]) return VEH_ICONS[v.iconKey];
  const key = (v.type && TYPE_DEFAULT[v.type]) || "car";
  return VEH_ICONS[key];
}
