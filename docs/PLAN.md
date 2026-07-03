# Plan d'exécution Kelentane GPS (§17 du handoff)

Méthode : 1 étape = 1 commit qui build vert. Ne pas passer à N+1 sans build vert de N.

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
| 10 | i18n (FR défaut + Wolof + EN + AR) + unités + source Baidu | 🚧 10a ✅ / 10b ⬜ |
| 11 | Externaliser icônes en SVG | ⬜ |

## Dette technique BLOQUANTE avant mise en production

- **[BLOQUANT] Remplacer le polling `/vehicles` par le WebSocket Traccar
  relayé par la façade.** L'étape 3 livre un polling 10 s (`src/data/useVehicles.ts`).
  Ce n'est PAS acceptable en prod (latence, charge, coût data au Sénégal).
  La façade doit ouvrir `GET /api/socket` Traccar (session serveur) et rediffuser
  positions + événements au mobile (WS/SSE), sans jamais exposer Traccar au client.
  À faire avant la prod réelle — pas « si le temps le permet ».

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
- **10b à faire** : extraire les chaînes des écrans restants (Alarmes, Km, Stats,
  Trajet, Géofence, lignes Détail) + provider carte **Baidu** (SDK natif).
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
- ⬜ Externaliser les icônes véhicules en SVG (étape 11).
- ⬜ Km/Stats : séparer réellement (étape 7).
