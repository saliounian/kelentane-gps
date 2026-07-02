import type { NavigatorScreenParams } from "@react-navigation/native";

/** Onglets (états `screen` maquette). Noms alignés sur TabId. */
export type TabParamList = {
  map: undefined;
  list: undefined;
  alarm: undefined;
  stats: undefined;
  me: undefined;
};

/** Stack racine : les onglets + les écrans internes (détail, etc.). */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Detail: { vehicleId: number };
  IconPicker: { vehicleId: number };
};
