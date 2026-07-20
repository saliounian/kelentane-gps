import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { registerPushToken } from "./alarms";

/** Canal Android des alarmes — doit correspondre au `channelId` envoyé par l'API. */
const ALARM_CHANNEL = "alarms";

/**
 * Affichage des notifications reçues APP AU PREMIER PLAN. Sans ce handler,
 * expo-notifications n'affiche rien tant que l'app est ouverte : l'utilisateur
 * rate l'alarme alors que le push est bien arrivé. Enregistré au chargement du
 * module (avant tout rendu), comme le veut la doc Expo SDK 57.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Canal Android « alarms » en importance MAX : bannière en tête d'écran + son,
 * y compris app en arrière-plan. Un canal absent ou d'importance basse fait
 * atterrir la notif silencieusement dans le tiroir (bug « rien ne s'affiche »).
 * Créer le canal est idempotent : rappeler la fonction met à jour ses réglages.
 */
async function ensureAlarmChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL, {
    name: "Alarmes véhicules",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
}

/**
 * Enregistrement push : permission → canal Android → jeton Expo stocké côté API.
 * Le routage vers FCM/APNs est fait par Expo selon les credentials EAS. En
 * émulateur / sans projectId EAS, la fonction se retire sans bruit.
 */
export async function registerForPush(): Promise<void> {
  if (!Device.isDevice) return; // pas de push sur émulateur

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return;

  await ensureAlarmChannel();

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
    await registerPushToken(token, platform);
  } catch {
    // projectId EAS requis pour un vrai jeton — ignoré tant que non configuré.
  }
}
