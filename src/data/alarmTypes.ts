import {
  Battery,
  Clock,
  CreditCard,
  Gauge,
  LogIn,
  LogOut,
  Moon,
  Move,
  Power,
  Radio,
  Satellite,
  WifiOff,
} from "lucide-react-native";
import { ALERT, OFFLINE, ONLINE, PARKED } from "../theme/tokens";
import type { LucideIcon } from "../types/models";

export type AlarmCat = "event" | "anomaly";

export interface AlarmType {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  cat: AlarmCat;
}

/** Registre des types d'alarme (maquette ALARM_TYPES). Événements PARKED, jamais lime. */
export const ALARM_TYPES: AlarmType[] = [
  { id: "geo_out", label: "Sortie de géofence", icon: LogOut, color: PARKED, cat: "event" },
  { id: "geo_in", label: "Entrée de géofence", icon: LogIn, color: PARKED, cat: "event" },
  { id: "speed", label: "Excès de vitesse", icon: Gauge, color: PARKED, cat: "event" },
  { id: "tow", label: "Mouvement sans contact", icon: Move, color: ALERT, cat: "event" },
  { id: "hours", label: "Déplacement hors horaires", icon: Moon, color: PARKED, cat: "event" },
  { id: "ignition", label: "Démarrage moteur", icon: Power, color: ONLINE, cat: "event" },
  { id: "disconnect", label: "Déconnexion prolongée", icon: WifiOff, color: ALERT, cat: "anomaly" },
  { id: "sim", label: "SIM / forfait épuisé", icon: CreditCard, color: ALERT, cat: "anomaly" },
  { id: "power", label: "Alimentation coupée", icon: Power, color: ALERT, cat: "anomaly" },
  { id: "battery", label: "Tension batterie faible", icon: Battery, color: PARKED, cat: "anomaly" },
  { id: "gsm", label: "Signal GSM faible", icon: Radio, color: PARKED, cat: "anomaly" },
  { id: "gps_lost", label: "Perte du signal GPS", icon: Satellite, color: ALERT, cat: "anomaly" },
  { id: "late", label: "Données en retard", icon: Clock, color: OFFLINE, cat: "anomaly" },
];

export const ALARM_TYPE_BY_ID: Record<string, AlarmType> = Object.fromEntries(
  ALARM_TYPES.map((a) => [a.id, a]),
);
