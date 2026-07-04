# Plan d'exécution Kelentane GPS (§17 du handoff)

Méthode : 1 étape = 1 commit qui build vert. Ne pas passer à N+1 sans build vert de N.

---

## 📌 État du projet — au 2026-07-04

### ✅ Livré et fonctionnel (committé, build vert, smoke réel)
- **Toutes les étapes §17 (0→11)** : design system, /ui, infra, carte+liste, détail
  +commandes (ACK), persistance, alarmes/anomalies, km/stats/trajet, géofences,
  auth (login/register/gate/session), partage jeton, i18n (FR/EN + wo/ar fallback),
  unités, icônes SVG externalisées.
- **Isolation multi-tenant** sur tous les endpoints (REST + WebSocket), vérifiée live.
- **WebSocket temps réel** (Socket.io relayé depuis Traccar) — remplace le polling,
  fallback polling en repli, **+ refresh périodique du `allowed`** (60 s + event).
  Testé bout-en-bout GT06→Traccar(VPS)→WS→client.
- **Sélecteur de langue en liste** (bottom sheet radio, RTL arabe).
- **Ajout / suppression de véhicule** : enrôlement (POST /vehicles) + suppression
  **protégée par mot de passe compte** (vérif serveur). Boutons Carte/Liste câblés.
- **Déploiement API** : Dockerfile + infra/docker-compose.yml (Traccar+API réseau
  interne) + docs/DEPLOY.md. Mobile `API_URL` via `EXPO_PUBLIC_API_URL` (défaut VPS)
  + cleartext HTTP autorisé.
- **Tenant démo** isolé (`demo`/`KelentaneDemo1`, 3 véhicules) + seed script + DEMO.md.

### 🚧 En cours (code écrit, PAS encore committé/testé au moment de ce récap)
- **notification-prefs & push tokens → compte réel** : `NotificationsService` +
  controller re-câblés sur `userId` (JWT) au lieu du seed owner ; `AuthGuard` ajouté ;
  mobile envoie le Bearer sur prefs-patch + push-register. → à builder/smoker/committer.
- **Préparation push réel** : `PushService` (Expo Push API, respecte prefs armed/type),
  gardé par `PUSH_ENABLED=false` (aucun envoi tant que non activé) + endpoint
  `POST /push/test`. Vars `PUSH_ENABLED` / `EXPO_ACCESS_TOKEN` ajoutées aux .env.example.
  → à builder/smoker/committer + docs/PUSH.md à finaliser (liste credentials FCM/APNs).

### ▶️ Prochaines priorités
1. **Finaliser notif-prefs + push prep** : build vert (nest build, tsc, export),
   smoke (prefs isolées par user, /push/test → skipped car désactivé), commit + docs/PUSH.md.
2. **Activer push** une fois credentials fournis (FCM V1 service account + APNs .p8
   dans EAS ; passer `PUSH_ENABLED=true`) + **moteur d'alarmes** qui appelle `sendToUser`.
3. **HTTPS + domaine** pour l'API (reverse proxy) avant prod réelle ; retirer cleartext.
4. **Traductions wo/ar** par un locuteur natif (actuellement fallback FR).
5. **Baidu** (module natif RN) si couverture Google insuffisante.

---

| # | Étape | État |
|---|-------|------|
| 0 | Scaffold Expo + design system (tokens, typos, thème) | ✅ |
| 1 | Primitives `/ui` extraites de la maquette | ✅ |
| 2 | Infra : Traccar (docker), API façade Nest, Supabase (schéma + RLS) | ✅ |
| 3 | Liste + carte sur positions réelles | ✅ (polling) |
| 4 | Fiche détail complète + commandes réelles (ACK) | ✅ |
| 5 | Édition persistée (jointure base app) + détails dispositif | ✅ |
| 6 | Alarmes / anomalies + push | ✅ (push : envoi différé) |
| 7 | Km / Stats / Trajet via reports Traccar | ✅ |
| 8 | Géofences CRUD + règles | ✅ |
| 9 | Auth (login/register/gate/session) + partage jeton + mdp commandes | ✅ |
| 10 | i18n (FR défaut + Wolof + EN + AR) + unités + source Baidu | ✅ (Baidu natif à part) |
| 11 | Externaliser icônes véhicules (PNG → /assets) | ✅ |

## Dette technique BLOQUANTE avant mise en production

- **[FAIT] WebSocket Traccar relayé (remplace le polling).** La façade ouvre le
  WS natif Traccar (`/api/socket`, login session), et rediffuse les positions au
  mobile via **Socket.io** (`RealtimeModule` : `TraccarRealtimeService` +
  `PositionsGateway`). Isolation multi-tenant appliquée à la source (filtrage par
  IMEIs du compte, JWT vérifié à la connexion). Mobile : `useVehicles` reçoit
  `snapshot` + `positions`, avec **polling REST de secours** tant que le WS est
  déconnecté (reco auto Socket.io). Même port que l'API (pas de nouveau port).
  Test à faire côté humain : bout-en-bout avec Traccar + `gt06-sim` (voir docs/DEMO.md).

- **[BLOQUANT] Envoi réel des notifications push.** L'étape 6 livre le scaffold
  (enregistrement des jetons `push_tokens`, prefs). L'ENVOI (FCM/APNs via Expo)
  n'est pas branché : il exige des credentials (projet FCM, clé serveur, projectId
  EAS) + un dev-build. Sans ça, les alarmes ne partent pas vers le téléphone.
  À faire avant la prod. Côté API : un worker qui, sur événement Traccar / calcul
  d'anomalie, pousse via Expo Push API vers les jetons du client (selon prefs).

## Config Supabase requise (côté humain, dashboard)

- **[REQUIS 9a] Désactiver « Confirm email »** (Auth → Providers → Email) : les
  identités sont des emails synthétiques `{username}@kelentane.app` non
  délivrables ; sans ça, pas d'accès immédiat après inscription.
- **[REQUIS 9] Activer « Leaked password protection »** (advisor sécurité ouvert).
- Décision identité : email synthétique dérivé du username.
- **[IMPORTANT] Domaine synthétique = `@kelentane.com` (a des MX).** GoTrue rejette
  à l'inscription publique les domaines sans MX (`@kelentane.app` → « invalid »).
  Aucun email n'est envoyé (Confirm email off) ; ce sont des identités.
- **[À surveiller] Rate limit signup GoTrue** (« email rate limit exceeded » lors
  d'appels rapprochés). OK en usage réel ; augmenter les limites / configurer SMTP
  si inscription en masse.
- **[FAIT] Isolation multi-tenant (confidentialité inter-clients).** Tous les
  endpoints véhicule sont sous `AuthGuard` + filtrés au périmètre du compte
  (`AccessService.allowed` = devices possédés + partagés) : `/vehicles` (liste +
  patch), `/vehicles/:id/{km,stats,route,commands,geofences,share}`,
  `/geofences/:gid` (patch/delete), `/alarms/{events,anomalies}`. Un compte ne
  voit/agit QUE sur ses véhicules (vérifié : owner→[imei], autre user→[]).
- **[À suivre] notification-prefs / push** sont encore rattachés au propriétaire
  seed (pas au compte courant). Non-confidentiel (pas de donnée véhicule d'autrui),
  à raccorder au user à l'occasion.

## i18n (étape 10)

- **10a fait** : infra `i18next`/`react-i18next` + `expo-localization`, catalogues
  `fr` (maître) + `en` complets, `wo`/`ar` partiels (fallback `fr`), langue persistée
  (AsyncStorage), unités km/mi (contexte + conversions), source carte persistée.
  Écrans extraits : TabBar, Auth, Profil ; unités appliquées Map/Liste/Détail.
- **10b fait** : tous les écrans statiques extraits (Map, Liste, Détail+PasswordSheet,
  Alarmes+AlarmSettings, AlarmLocation, Km, Stats, Trajet, Géofence). Catalogues
  fr/en complets pour ces écrans.
- **Reste FR (dette, non bloquant)** :
  - Chaînes de registre `ALARM_TYPES` (labels des types d'alarme) et
    `VEH_ICON_LABELS` (libellés d'icônes) — à extraire pour i18n complet.
  - Contenu **dynamique serveur** (causes/actions d'anomalie, `statusText`,
    adresses géocodées) reste dans la langue fournie par l'API/Traccar.
  - **Baidu** : le toggle persiste mais le rendu Baidu exige un **module natif RN**
    (pas dispo en Expo managed sans plugin/dev-module) — intégration séparée.
- **[À vérifier humain] Traductions `wo`/`ar`** = ébauches, à faire relire par un
  locuteur natif. **RTL (arabe)** : `I18nManager.forceRTL` exige un **redémarrage
  de l'app** pour s'appliquer pleinement (pas de reload auto sans expo-updates).

## Clés / secrets build

- **Google Maps Android** : injectée via `app.config.js` depuis
  `process.env.GOOGLE_MAPS_ANDROID_KEY` (secret EAS) — **jamais** en dur dans
  app.json. Restreinte (package `com.kelentane.gps` + SHA-1 keystore EAS + Maps SDK
  for Android). Créer : `eas secret:create --scope project --name
  GOOGLE_MAPS_ANDROID_KEY --value <clé> --type string`. Local (`expo run:android`) :
  exporter la variable avant de lancer.

## Décisions arrêtées (rappel)

- Plateforme : **Expo (React Native)**.
- Km et Stats : **écrans séparés** (handoff §6.5), pas fusionnés comme la maquette.
- i18n de départ : **FR (défaut) + Wolof + EN + AR (RTL)**.
- Monorepo : mobile à la racine, `api/` + `infra/` frères.
- Supabase : projet dédié `kelentane-gps` (eu-west-3).

## Dette connue (handoff §16) — suivi

- ✅ Icône par défaut alignée sur le `type` (`src/icons/vehicleIcons.ts`).
- ✅ `SubUsersSheet` absent (déjà retiré dans la maquette de référence).
- ✅ Seuils de fraîcheur externalisés (`FRESHNESS` dans les tokens).
- ✅ Icônes véhicules externalisées hors du bundle JS → `assets/vehicles/*.png`
  (12 : car/suv/van/pickup/truck/bus/moto/taxi/ambulance/sport + 2 racing client).
  ⬜ Vectorisation SVG restante (source raster PNG → redraw design, non bloquant).
- ✅ Km/Stats séparés (étape 7).
