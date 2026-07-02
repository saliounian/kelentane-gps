import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { registerPushToken } from "./alarms";

/**
 * Enregistrement push (scaffold étape 6).
 * Récupère le jeton et le stocke côté API. L'ENVOI réel des alarmes est différé :
 * il exige des credentials (FCM/APNs + projectId EAS) et un dev-build — voir
 * docs/PLAN.md. En émulateur / sans projectId, la fonction se retire sans bruit.
 */
export async function registerForPush(): Promise<void> {
  if (!Device.isDevice) return; // pas de push sur émulateur

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return;

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
    await registerPushToken(token, platform);
  } catch {
    // projectId EAS requis pour un vrai jeton — ignoré tant que non configuré.
  }
}
