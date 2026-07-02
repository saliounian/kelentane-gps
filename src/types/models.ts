import type { LucideIcon } from "lucide-react-native";
import type { VehicleStatus } from "../theme/tokens";

export type { LucideIcon };
export type { VehicleStatus };

/** Onglets de la TabBar (états `screen` de la maquette). */
export type TabId = "map" | "list" | "alarm" | "stats" | "me";

/** État d'une commande envoyée au boîtier (maquette : runCommand / CommandToast). */
export type CommandState = "pending" | "success" | "offline" | "error";

export type Command = {
  state: CommandState;
  label: string;
};
