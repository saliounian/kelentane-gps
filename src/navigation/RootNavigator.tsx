import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { MapScreen } from "../screens/MapScreen";
import { ListScreen } from "../screens/ListScreen";
import { DetailScreen } from "../screens/DetailScreen";
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
      <Tab.Screen name="alarm">{() => <PlaceholderScreen title="Alarmes" step="étape 5" />}</Tab.Screen>
      <Tab.Screen name="stats">{() => <PlaceholderScreen title="Stats" step="étape 6" />}</Tab.Screen>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
