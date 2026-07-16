# Notifications push — Kelentane GPS

> **État au 2026-07-16 — ANDROID ACTIVÉ.**
> - FCM V1 configuré côté EAS (clé de compte de service téléversée + assignée à
>   `com.kelentane.gps`).
> - `google-services.json` à la racine + référencé via `app.json`
>   (`expo.android.googleServicesFile`).
> - `PUSH_ENABLED=true` (examples + `.env` local ; **à mettre aussi sur le VPS**).
> - **Pont événements → push câblé** : `TraccarRealtimeService.events$` →
>   `AlarmPushBridge` → `PushService.sendToUser` pour geofence enter/exit,
>   excès de vitesse, coupure de contact (ignitionOff → préf `ignition`).
> - **iOS / APNs : reste à faire** (section B ci-dessous).
>
> ⚠️ **Smoke test réel non concluant à ce jour** : le seul jeton en base est un
> placeholder de seed (`ExponentPushToken[test123]`) → Expo répond
> `DeviceNotRegistered`. Le pipeline est prouvé jusqu'à Expo (HTTP 200 + ticket
> par-jeton + purge des jetons morts), mais une **livraison réelle** exige :
> 1) un build EAS **de cette branche** (avec `googleServicesFile`) installé sur un
> device Android, 2) ouvrir l'app pour enregistrer un vrai ExponentPushToken,
> 3) relancer le test (`POST /push/test` connecté, ou déclencher un vrai événement
> Traccar). Le contexte historique de config reste ci-dessous.

État initial au 2026-07-04. Ce document liste ce qu'il fallait créer/récupérer
pour brancher le push réel.

## Architecture retenue : relais Expo Push (FCM V1 + APNs)

L'app mobile émet un **ExponentPushToken** (`getExpoPushTokenAsync`, voir
`src/data/push.ts`). L'API façade (`api/src/notifications/push.service.ts`)
envoie à `https://exp.host/--/api/v2/push/send`. **Expo relaie** ensuite vers :

- **FCM V1** (Firebase Cloud Messaging) pour Android
- **APNs** (Apple Push Notification service) pour iOS

Conséquence importante : les credentials FCM/APNs se déposent **dans Expo/EAS**,
pas dans l'API. L'API n'a besoin d'aucune clé Firebase Admin SDK pour ce chemin.
(La clé de service Firebase que tu mentionnais sert bien — mais elle est
téléversée vers Expo pour FCM V1, elle ne vit pas dans le serveur NestJS.)

Identifiants du projet (déjà en place) :
- slug Expo : `kelentane-gps`
- EAS projectId : `7b68b6e7-be73-4a0e-8aeb-c1498548ee28`
- package Android / bundleId iOS : `com.kelentane.gps`
- plugin `expo-notifications` : présent dans `app.json`

---

## CE QUE TU DOIS CRÉER / RÉCUPÉRER

### A. Android — FCM V1 (obligatoire pour push Android)

1. **Projet Firebase** — https://console.firebase.google.com → créer un projet
   (ou réutiliser un existant).
2. **App Android dans ce projet** — « Ajouter une app » → Android → package
   **`com.kelentane.gps`**. Télécharger le fichier **`google-services.json`**.
3. **Clé de compte de service (FCM V1)** — Firebase → ⚙ Paramètres du projet →
   onglet **Comptes de service** → « Générer une nouvelle clé privée » →
   fichier **JSON** (secret, ne jamais committer).
4. **Téléverser vers Expo** :
   - `google-services.json` → référencé au build. Le plus simple : le déposer à
     la racine et ajouter `android.googleServicesFile` dans `app.json`, **ou**
     le fournir en secret EAS (`eas secret:create`).
   - Clé de service JSON → `eas credentials` → Android → *Push Notifications:
     Google Service Account Key* (ou via expo.dev → projet → Credentials).

⚠️ `google-services.json` est intégré **au moment du build**. Le build EAS en
cours (sans FCM) ne pourra pas recevoir de push Android → il faudra **relancer
un build** une fois `google-services.json` ajouté.

### B. iOS — APNs (uniquement si iOS est prévu)

1. **Compte Apple Developer** payant (99 $/an) requis.
2. **Clé APNs (.p8)** — https://developer.apple.com → Certificates, IDs &
   Profiles → **Keys** → créer une clé, cocher *Apple Push Notifications service
   (APNs)*. Télécharger le **`.p8`** (téléchargeable une seule fois) + noter le
   **Key ID** et le **Team ID**.
3. **Téléverser vers Expo** : `eas credentials` → iOS → Push Notifications →
   fournir le `.p8` (Expo peut aussi la générer/gérer si tu connectes ton compte
   Apple). Le `bundleIdentifier` `com.kelentane.gps` doit avoir la capacité Push
   activée (Expo/EAS le fait automatiquement au build).

### C. API façade (serveur NestJS)

1. **`EXPO_ACCESS_TOKEN`** (recommandé en prod, optionnel) — expo.dev →
   paramètres du compte → **Access Tokens** → générer. Renforce la sécurité
   (empêche l'envoi usurpé) et l'authentification des envois. À mettre dans
   `api/.env` (déjà présent, vide) — **jamais** committé.
2. **`PUSH_ENABLED=true`** — à basculer **seulement** une fois A (et B si iOS)
   faits et un build intégrant `google-services.json` déployé.

---

## Récapitulatif — checklist courte

| # | À faire | Où | Résultat |
|---|---------|-----|---------|
| 1 | Créer projet + app Android Firebase | console.firebase.google.com | `google-services.json` |
| 2 | Générer clé compte de service | Firebase → Comptes de service | JSON secret |
| 3 | Téléverser clé + json | `eas credentials` / secret EAS | FCM V1 prêt |
| 4 | (iOS) Clé APNs .p8 | developer.apple.com → Keys | `.p8` + KeyID + TeamID |
| 5 | (iOS) Téléverser .p8 | `eas credentials` | APNs prêt |
| 6 | Rebuild EAS avec google-services.json | `eas build` | build push-capable |
| 7 | `EXPO_ACCESS_TOKEN` (option) | expo.dev → tokens | envoi authentifié |
| 8 | `PUSH_ENABLED=true` | `api/.env` | activation réelle |

---

## Côté code : déjà prêt (ne rien activer)

- `api/src/notifications/push.service.ts` — `sendToUser(userId, msg)` :
  respecte les prefs (`armed` + par type), lit les jetons du **compte réel**
  (`client_id = userId`), découpe par lots de 100 (limite Expo), et **purge les
  jetons morts** (`DeviceNotRegistered`). No-op tant que `PUSH_ENABLED != true`.
- `POST /push/test` — envoie une notif de test au compte courant (utile pour
  valider une fois les credentials en place).
- Prefs & jetons rattachés au `user.id` du JWT (plus au seed) — isolation
  multi-tenant : filtrage explicite par `client_id` partout + RLS `self` en base
  (`0001_init...sql`, `0003_push_tokens.sql`).

## Câblage événements → push (2026-07-16)

- `api/src/realtime/traccar-realtime.service.ts` — consomme désormais le frame
  `events` du WebSocket Traccar (en plus des `positions`) et émet sur `events$`
  chaque événement enrichi de l'`imei` + nom du device.
- `api/src/realtime/alarm-push.bridge.ts` — écoute `events$`, mappe le type
  Traccar → id d'alarme + libellé FR, résout **tous les comptes** avec
  `device_access` ACTIF sur le device, et appelle `PushService.sendToUser`
  (qui respecte `armed` + préférence par type). Inactif si `PUSH_ENABLED != true`.
- Mapping : `geofenceEnter→geo_in`, `geofenceExit→geo_out`,
  `deviceOverspeed→speed`, `ignitionOff→ignition` (pas d'id « coupure de contact »
  dédié → réutilise la préf `ignition`). Autres types ignorés pour l'instant.

## Reste à faire

- **iOS / APNs** (section B) : clé `.p8` + `eas credentials` iOS. Non commencé.
- **VPS** : mettre `PUSH_ENABLED=true` dans le `.env` déployé + `pm2 restart`.
- **Vrai jeton device** : build de cette branche + installation + ouverture app.

## Alternative (non retenue) : FCM/APNs direct

Possible de faire parler l'API directement à FCM (Firebase Admin SDK) et APNs,
sans Expo. Non retenu car l'app émet un **ExponentPushToken**, pas un token FCM
brut : il faudrait changer `src/data/push.ts` (`getDevicePushTokenAsync`) et
ajouter `firebase-admin` + une lib APNs côté serveur. À rediscuter uniquement si
tu veux te passer du relais Expo.
