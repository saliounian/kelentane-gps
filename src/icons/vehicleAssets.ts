/**
 * Assets d'icônes véhicules — PNG externalisés hors du bundle JS (étape 11, §8).
 * Art fourni par le client (dimensionnel vu du dessus + 2 illustrations « racing »).
 * Chargés en fichiers /assets (require) plutôt qu'en base64 inline.
 *
 * TODO [design] : vectoriser en SVG (le handoff préfère du vectoriel ; la source
 * est raster PNG, la revectorisation est une tâche de design séparée).
 */
export const VEHICLE_ASSETS: Record<string, number> = {
  car: require("../../assets/vehicles/car.png"),
  suv: require("../../assets/vehicles/suv.png"),
  van: require("../../assets/vehicles/van.png"),
  pickup: require("../../assets/vehicles/pickup.png"),
  truck: require("../../assets/vehicles/truck.png"),
  bus: require("../../assets/vehicles/bus.png"),
  moto: require("../../assets/vehicles/moto.png"),
  taxi: require("../../assets/vehicles/taxi.png"),
  ambulance: require("../../assets/vehicles/ambulance.png"),
  sport: require("../../assets/vehicles/sport.png"),
  racingR: require("../../assets/vehicles/racingr.png"),
  racingY: require("../../assets/vehicles/racingy.png"),
};
