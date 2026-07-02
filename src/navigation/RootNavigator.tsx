import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { MapScreen } from "../screens/MapScreen";
import { ListScreen } from "../screens/ListScreen";
import { DetailScreen } from "../screens/DetailScreen";
import { IconPickerScreen } from "../screens/IconPickerScreen";
import { AlarmsScreen } from "../screens/AlarmsScreen";
import { AlarmLocationScreen } from "../screens/AlarmLocationScreen";
import { StatsScreen } from "../screens/StatsScreen";
import { KmScreen } from "../screens/KmScreen";
import { TrajectoryScreen } from "../screens/TrajectoryScreen";
import { GeofenceScreen } from "../screens/GeofenceScreen";
import { PlaceholderScreen } from "../screens/PlaceholderScreen";
import { AppTabBar } from "./AppTabBar";
import type { RootStackParamList, TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs() {
  const { t } = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}
    >
      <Tab.Screen name="map" component={MapScreen} />
      <Tab.Screen name="list" component={ListScreen} />
      <Tab.Screen name="alarm" component={AlarmsScreen} />
      <Tab.Screen name="stats" component={StatsScreen} />
      <Tab.Screen name="me">{() => <PlaceholderScreen title="Profil" step="étape 8" />}</Tab.Screen>
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { t, dark } = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme: NavTheme = {
    ...base,
    colors: { ...base.colors, background: t.bg, card: t.bg, text: t.text, primary: t.accent, border: t.border },
  };
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Detail" component={DetailScreen} />
        <Stack.Screen name="IconPicker" component={IconPickerScreen} />
        <Stack.Screen name="AlarmLocation" component={AlarmLocationScreen} />
        <Stack.Screen name="Km" component={KmScreen} />
        <Stack.Screen name="Traj" component={TrajectoryScreen} />
        <Stack.Screen name="Geo" component={GeofenceScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
