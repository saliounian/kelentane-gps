import {
  Ambulance,
  Bike,
  Bus,
  Car,
  Caravan,
  Plane,
  Ship,
  Tractor,
  Train,
  Truck,
} from "lucide-react-native";
import type { LucideIcon } from "../types/models";
import type { VehicleVM } from "../types/vehicle";

/** Clés d'icônes du sélecteur (maquette VEH_ICONS). */
export const VEH_ICONS: Record<string, LucideIcon> = {
  car: Car,
  truck: Truck,
  bus: Bus,
  bike: Bike,
  caravan: Caravan,
  tractor: Tractor,
  ambulance: Ambulance,
  train: Train,
  ship: Ship,
  plane: Plane,
};

export const VEH_ICON_LIST = [
  "car",
  "truck",
  "bus",
  "bike",
  "caravan",
  "tractor",
  "ambulance",
  "train",
  "ship",
  "plane",
] as const;

export const VEH_ICON_LABELS: Record<string, string> = {
  car: "Voiture",
  truck: "Camion",
  bus: "Bus",
  bike: "Moto",
  caravan: "Caravane",
  tractor: "Tracteur",
  ambulance: "Ambulance",
  train: "Train",
  ship: "Bateau",
  plane: "Avion",
};

/** Icône par défaut dérivée du type véhicule (dette §16 : aligner défaut sur type). */
const TYPE_DEFAULT: Record<string, string> = {
  car: "car",
  van: "truck",
  truck: "truck",
  bus: "bus",
  moto: "bike",
  taxi: "car",
  ambulance: "ambulance",
  other: "car",
};

/** Icône effective d'un véhicule : clé choisie, sinon défaut selon le type. */
export function iconForVehicle(v: Pick<VehicleVM, "iconKey" | "type">): LucideIcon {
  if (v.iconKey && VEH_ICONS[v.iconKey]) return VEH_ICONS[v.iconKey];
  const key = (v.type && TYPE_DEFAULT[v.type]) || "car";
  return VEH_ICONS[key];
}
