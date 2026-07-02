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
| 8 | Géofences CRUD + règles | ⬜ |
| 9 | Partage par jeton + auth + mot de passe commandes | ⬜ |
| 10 | i18n (FR défaut + Wolof + EN + AR) + unités + source Baidu | ⬜ |
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
