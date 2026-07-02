# Kelentane GPS — Document de passation pour Claude Code

> **But de ce document** : permettre à Claude Code de passer directement de la maquette React (`kelentane-gps-mockup.jsx`) à une **application de production** sans redécouvrir le projet. Il décrit le design system, l'architecture, les données, chaque écran, le système d'icônes, et surtout **ce qui est maquette pure vs. logique réelle à implémenter côté backend**.
>
> **Fichier de référence** : `kelentane-gps-mockup.jsx` (single-file React, ~2650 lignes). C'est la **source de vérité visuelle et comportementale**. Toute divergence se tranche en faveur de la maquette.
>
> **Contexte produit** : Kelentane est une activité sénégalaise de traceurs GPS / télématique flotte (marque `kelentane.com`), 3+ ans d'activité, matériel GT06N sourcé sur Alibaba. L'app est destinée aux clients (propriétaires de véhicules/flottes) pour suivre leurs véhicules, recevoir des alarmes, couper le moteur à distance, etc. Marché : Sénégal (français, réseau parfois faible, cartes Google + option Baidu). Langue par défaut : **français**.

---

## 1. Résumé exécutif — quoi faire, dans quel ordre

1. **Extraire le design system** de la maquette en tokens réutilisables (voir §4). Ne pas réinventer les couleurs/typos.
2. **Découper le single-file** en une vraie arborescence de composants (voir §5).
3. **Choisir le backend GPS** : **Traccar recommandé** comme cœur d'ingestion/commandes, + couche API applicative + base app (Supabase). Voir §9.
4. **Remplacer toutes les données mockées** (§7 et §14) par de vraies sources : positions temps réel, historique, alarmes, santé dispositif, kilométrage, stats.
5. **Câbler les actions réelles** : coupure/redémarrage moteur, redémarrage GPS, géofences, partage d'appareil (§8, §9, §12).
6. **Brancher la carte réelle** (Google Maps SDK, Street View, option Baidu) à la place de la fausse carte SVG (§11).
7. **Auth + permissions + partage** (§12), **i18n** (§13).

Le mockup est **fonctionnel en local** (états, navigation, sheets, toasts) mais **toutes les données sont statiques** et **aucune action ne touche un vrai boîtier**.

---

## 2. Ce qui est livré, et comment le lire

- **1 fichier** : `kelentane-gps-mockup.jsx` — export par défaut `KelentaneGPS`. Aucune dépendance hors `react` et `lucide-react@0.383.0`.
- **Rendu** : un cadre « téléphone » centré, thème clair **et** sombre (toggle en bas), barre d'onglets flottante en verre.
- **Style** : « Liquid Glass » (Apple 26) — surfaces translucides, blur, accent citron vert.
- **Icônes véhicules** : PNG détourés embarqués en base64 (dimensionnels, vus du dessus) + 2 illustrations « racing » fournies par le client.

### Workflow de validation (à conserver)
Après **chaque** modification du fichier maquette (tant qu'on itère dessus) :
```bash
cd <dossier> && cp kelentane-gps-mockup.jsx /tmp/check.jsx && \
esbuild /tmp/check.jsx --bundle --loader:.jsx=jsx --jsx=automatic \
  --external:react --external:lucide-react --outfile=/tmp/out.js
```
⚠️ esbuild **ne détecte pas** les composants React non définis ni les icônes lucide manquantes (lucide est externalisé). Compléter par un **scan statique** : comparer les identifiants `<Capitalized>` / `icon={X}` **utilisés** vs. **importés/définis**, et vérifier que chaque nom d'icône lucide existe réellement dans `require("lucide-react")` en 0.383.0. Vérifier aussi que chaque clé de `VEH_ICON_LIST` a une entrée dans `VEH_ICONS`.

---

## 3. Stack de production recommandée

| Couche | Recommandation | Alternative |
|---|---|---|
| **App mobile** | React Native (Expo) **ou** PWA React + Capacitor | Flutter |
| **Cœur GPS** | **Traccar** (self-host) | Serveur custom Node (parseur GT06N) |
| **API applicative** | Node/Express ou NestJS, en façade de Traccar | Edge Functions |
| **Base app** | **Supabase** (Postgres + Auth + RLS) — déjà maîtrisée par le client | Firebase |
| **Cartes** | Google Maps SDK + Street View ; option **Baidu** (déjà prévue dans le profil) | Mapbox |
| **Temps réel** | WebSocket Traccar (`/api/socket`) relayé, ou Supabase Realtime | Polling |
| **Push** | FCM (Android) / APNs (iOS) pour alarmes | — |

> Le client maîtrise déjà **Supabase** et **Claude Code** (app GestComp). Réutiliser ces briques. Ne pas stocker de secrets/clefs dans le client. Positions et commandes transitent par l'API applicative, jamais Traccar exposé directement au mobile.

**Pourquoi Traccar** : supporte nativement le protocole **GT06N** (le matériel du client), gère l'ingestion des positions, les **géofences**, les **commandes** (dont coupure moteur `engineStop`/`engineResume`), les **événements/alarmes**, l'historique (reports). Cela évite d'écrire un parseur de trames et un moteur de règles. La couche API applicative ajoute : multi-tenant clients, partage d'appareil par IMEI, champs métier custom, i18n, facturation SIM, etc.

---

## 4. Design system (source de vérité : `theme()` et les constantes en tête de fichier)

### 4.1 Couleurs de marque et statuts (constantes globales)
```
LIME     = #D4FF17   // accent de marque — action / identité / nav active / halo de sélection
LIME_ON  = #15210A   // texte foncé posé SUR le lime (contraste)
TEAL/ONLINE = #36D399 // « en ligne » / « en mouvement »
PARKED   = #FFB14E   // « stationné »
OFFLINE  = #8E8E93   // « hors ligne »
ALERT    = #FF5C5C   // alarme / anomalie
ACCENT   = LIME
```
**RÈGLE ABSOLUE** : le **lime est réservé** à la marque / l'action / la sélection. Il ne code **jamais** un statut véhicule. Le statut se lit via TEAL/PARKED/OFFLINE/ALERT (pastille, anneau, pastille de statut), **pas** via l'icône (les icônes véhicules sont colorées, cf. §8 : le statut passe par l'anneau/la pastille, pas par la teinte de l'icône).

### 4.2 Tokens de thème — fonction `theme(dark)` renvoie :
| Token | Sombre | Clair |
|---|---|---|
| `bg` | `#06080F` | `#DFE7F0` |
| `text` | `#FFFFFF` | `#0A0C14` |
| `sub` | `rgba(255,255,255,0.58)` | `rgba(10,12,20,0.55)` |
| `accent` | `#D4FF17` | `#4F6B00` (chartreuse foncé, pour lisibilité sur fond clair) |
| `glass` | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.55)` |
| `glassSolid` | `rgba(20,24,34,0.78)` | `rgba(255,255,255,0.86)` |
| `border`, `line` | définis dans `theme()` | idem |

> Noter la subtilité : en **clair**, `accent` bascule sur un vert chartreuse foncé (`#4F6B00`) pour rester lisible sur fond clair, alors que le **lime pur** reste utilisé pour les fonds d'action (boutons) avec `LIME_ON` en texte. Reprendre cette logique en production.

### 4.3 Typographie (chargée via un `<link>` Google Fonts injecté au montage)
- **`Big Shoulders Display`** → tous les titres, labels de section, noms de véhicules, gros chiffres (km, stats), titres de sheets. Constante `DISPLAY`.
- **`IBM Plex Sans`** → police de corps (définie sur la racine). Constante `BODY`.
- **`IBM Plex Mono`** → données techniques (IMEI, ICCID, immatriculation, numéros, valeurs de tuiles). Constante `MONO`.

### 4.4 Effets & primitives
- **Glassmorphism** : surfaces `glass`/`glassSolid` + `backdrop-filter: blur(...)`. Helper `glassStyle(t)`.
- **`hexA(hex, alpha)`** : util pour teinter une couleur avec opacité (fonds de pastilles).
- **Boutons ronds** : `iconBtn(t)`, `ctrlBtn(t)`.
- **Pulse de sélection** : anneau lime animé (`@keyframes kpulse`) sur le véhicule actif de la carte.
- **Rayons** : cartes ~22px, tuiles ~14–16px, sheets 28px en haut.

### 4.5 Composants UI réutilisables (déjà dans la maquette, à extraire)
`StatusPill`, `StatusDot`, `Metric` (tuile valeur+label), `SectionLabel` / `SectionLabelInline`, `Row` (ligne lecture), `EditableRow` (ligne éditable), `Field` (input), `Cmd` (bouton commande), `ActionBtn`, `Toggle`, `KMonogram` (logo K lime), `TabBar`, `StatusBar`, `QuickDock`, `CommandToast`.

---

## 5. Architecture front — découpage cible

Le mockup est un seul composant `KelentaneGPS` avec un état `screen` qui route vers les écrans. À découper ainsi :

```
/src
  /theme        tokens.ts (couleurs, DISPLAY/BODY/MONO), theme(dark), glassStyle, hexA
  /ui           StatusPill, Metric, Row, EditableRow, Field, Cmd, ActionBtn, Toggle,
                KMonogram, TabBar, CommandToast, sheets (Password, DatePicker, ...)
  /icons        VehicleIcons (VEH_ICONS/VEH_ICON_LIST), PlusGrid, KMonogram
  /screens      Map, List, Detail, Geofence, Stats, Km, Trajectory, Profile,
                Alarms, AlarmLocation, IconPicker (désormais une PAGE, pas un sheet)
  /data         mappers API → view-models (remplacent les const mock)
  /api          client Traccar-façade + Supabase
  /state        store (vehicles, activeVehicle, theme, positions temps réel)
```

### 5.1 Routing / navigation (états `screen` réels dans la maquette)
`map` · `list` · `detail` · `geo` (géofence) · `me` (profil) · `alarm` (alarmes/anomalies) · `alarmloc` (position d'une alarme) · `stats` (onglet Stats) · `km` (kilométrage depuis la fiche) · `traj` (trajet/playback).

En production : mapper vers une vraie stack de navigation. La **TabBar** expose 5 onglets : **Carte / Véhicules / Alarmes / Stats / Profil** (couleur active = `t.accent`).

### 5.2 État global (au minimum)
- `dark` (thème), `screen`, `active` (véhicule sélectionné), `mapType` (`"plan"|"satellite"`), `iconMap` (id véhicule → clé d'icône choisie), sélection d'alarme.
- Helper `iconFor(veh)` = `VEH_ICONS[iconMap[veh.id]] || veh.icon`.
- **À ajouter en prod** : positions temps réel par device, connexion WebSocket, cache historique, notifications.

---

## 6. Modèle de données (shapes RÉELLES de la maquette) → mapping API

### 6.1 Véhicule (`VEHICLES[]`)
```jsonc
{
  "id": 1,
  "name": "Peugeot Expert",        // éditable dans la fiche (nom du dispositif)
  "plate": "DK-3048-AB",           // immatriculation (mono)
  "type": "van",                    // van|truck|bus|car (métier, indicatif)
  "status": "moving",               // moving|online|parked|offline
  "speed": 47,                      // km/h
  "battery": 80,                    // % batterie interne boîtier
  "signal": "GPS",                  // GPS|LBS (LBS = position approx. par cellule)
  "lat": "14.67684", "lng": "-17.44303",
  "voltage": 11,                    // tension véhicule (V)
  "addr": "Av. Blaise Diagne, Rebeuss, Dakar-Plateau",  // géocodage inverse
  "lastSeen": "<Date>",             // dernier point reçu
  "color": "<ONLINE|PARKED|OFFLINE|ALERT>",  // dérivé du statut
  "icon": "<composant icône par défaut>",
  "imei": "356 789 123 456 781",    // identifiant boîtier (clé d'appairage / partage)
  "sim": "Orange SN",               // opérateur SIM (éditable)
  "phone": "+221 77 845 12 30",     // n° SIM du boîtier (éditable, pour commandes SMS)
  "owner": "Salihou D. · +221 76 412 52 21",  // contact utilisateur
  "acc": true,                      // contact/ignition ON/OFF (ACC)
  "model": "GT06N",                 // modèle boîtier
  "gsm": 4,                         // qualité signal GSM /5
  "sats": 11,                       // satellites GPS
  "odo": 84210,                     // odomètre (km)
  "vbatt": 3.9,                     // tension batterie interne (V)
  "iccid": "8922 1100 0034 5678 901",
  "interval": 10,                   // fréquence d'envoi (s)
  "heading": "Nord-Ouest"           // cap
}
```
**Mapping Traccar** : `name/uniqueId(=imei)/status/lastUpdate` (device) + `position.latitude/longitude/speed/course/attributes` (`battery`, `power`/`voltage`, `sat`, `ignition`→acc, `odometer`, `rssi`→gsm, `distance`). `LBS` = point sans fix GPS (attribut `blocked`/absence de `valid`). `addr` = géocodage inverse (Traccar `address` ou service tiers).

**Statut** — logique de dérivation (à répliquer, cf. `freshColor()` dans la maquette) :
- `moving` : en ligne + vitesse > 0 → couleur ONLINE.
- `online` : point récent (< ~10 min) → ONLINE.
- `parked` : contact coupé / à l'arrêt mais récent → PARKED.
- `offline` : dernier point > 24 h (ou seuil) → OFFLINE. La maquette utilise des seuils 10 min / 24 h dans `freshColor(d)`.

### 6.2 Types d'alarmes (`ALARM_TYPES[]`) — 2 catégories : `event` et `anomaly`
- **Événements** (le véhicule fonctionne, simple notification) : `geo_out` (sortie géofence), `geo_in` (entrée), `speed` (excès de vitesse), `tow` (mouvement moteur éteint / remorquage → ALERT), `hours` (déplacement hors horaires), `ignition` (démarrage moteur).
- **Anomalies** (santé du dispositif, action requise) : `disconnect` (déconnexion prolongée), `sim` (SIM/forfait épuisé), `power` (alimentation coupée), `battery` (tension faible), `gsm` (signal GSM faible), `gps_lost` (perte GPS), `late` (données en retard).

Chaque type : `{ id, label, icon (lucide), color, cat: "event"|"anomaly" }`. **Note couleur** : les icônes d'événement utilisent PARKED (pas le lime).

### 6.3 Événements d'alarme (`ALARM_EVENTS[]`)
```jsonc
{ "type":"geo_out", "vehicle":"Master tine", "time":"09:32",
  "detail":"Zone « Garage Plateau »", "statusText":"Sortie de géofence",
  "speed":38, "dt":"2026-06-29 09:32:10",
  "addr":"Route de Ouakam, Dakar, Sénégal", "lat":"14.71250", "lng":"-17.46690" }
```
→ chaque ligne est cliquable (« Voir ») et ouvre `AlarmLocationScreen` (carte + popup blanc : Nom / Statut / Signal / Temps). **Mapping Traccar** : `reports/events` + `positions`.

### 6.4 Santé dispositif (`DEVICE_HEALTH[]`) — onglet Anomalies
```jsonc
{ "vehicle":"Fallou Bitey", "status":"problem",   // problem|check|ok
  "anomalies":[ { "type":"disconnect", "cause":"...", "action":"Recharger le forfait de la SIM" } ] }
```
→ cartes par véhicule (voyant OK/À vérifier/Problème). Les cartes `problem` se déplient : chaque anomalie affiche nom + cause + bouton d'action. **À calculer** côté backend à partir des attributs device (dernier contact, batterie, alim, forfait SIM).

### 6.5 Kilométrage & stats
```
DAYS = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"]
DATES = ["23".."29"]
KM_BY_VEHICLE = { <id>: [km parJour x7] }   // ex: 1:[42,0,58,31,47,12,65]
STATS_BY_VEHICLE = { <id>: { drive, idle, trips, stops, avg, max, over, days } }
```
→ **Km** (écran dédié, statut `km`) : total sur intervalle + barres km/jour + total **par véhicule**. **Aucune** donnée d'activité en bas (réservée à l'onglet Stats).
→ **Stats** (onglet, statut `stats`) : jour sélectionné, gros km, barres, résumé hebdo, **et** répartition d'activité (conduite/ralenti/trajets/arrêts/vitesse moy/max/excès/jours).
**Mapping Traccar** : `reports/trips`, `reports/stops`, `reports/summary`, `reports/route`.

### 6.6 Trajet / playback (`PLAYBACK[]`, `ROUTE_D`, `TRAJ[]`)
`PLAYBACK` = points {f (0→1), speed, dir, time, addr} pour l'animation ; `ROUTE_D` = path SVG (maquette) ; `TRAJ` = segments (départ/trajet/arrêt/arrivée). **En prod** : `reports/route` (polyline réelle) + interpolation temporelle pour le scrubber.

### 6.7 Libellés statut (`STATUS_LABEL`)
`moving→"En mouvement"`, `online→"En ligne"`, `parked→"Stationné"`, `offline→"Hors ligne"`.

---

## 7. Ce qui est MAQUETTE PURE vs LOGIQUE RÉELLE

| Élément | État maquette | À faire en prod |
|---|---|---|
| Carte | Faux fond SVG (`MapGrid`, `SatLayer`) + marqueurs positionnés en px | Vraie carte (Google), positions lat/lng réelles, clustering |
| Positions | Statiques dans `VEHICLES` | Flux temps réel (WebSocket) + géocodage inverse pour `addr` |
| Commandes moteur | `runCommand()` simule pending→success/offline/error selon `gsm` | Vraie commande via API (Traccar `commands`) + retour d'ACK |
| Alarmes/anomalies | Listes statiques | Événements réels + moteur de règles + push |
| Km / Stats / Trajet | Tableaux statiques | Reports Traccar |
| Ajout d'appareil | `AddDeviceSheet` ajoute un objet local complet | Enrôlement réel (créer device Traccar + entrée app + SIM) |
| Suppression | Long-press → `PasswordSheet` → retire de la liste | Suppression réelle (device + accès) |
| Édition champs | `EditableRow` met à jour l'état local | Persister (nom, SIM, n°, etc.) |
| Partage appareil | `ShareImeiSheet` affiche l'IMEI + Copier | Générer un vrai lien/jeton de partage (§12) |
| Street View | Ouvre `google.com/maps/@?...pano` | Idem ou SDK Street View intégré |
| Changer mot de passe | `PasswordChangeSheet` valide en local | Vrai endpoint auth |
| Langue | `LanguageSheet` (10 langues) | i18n réelle (§13) |
| Géofences | Dessin local (cercle/polygone), toggle, save | CRUD géofences Traccar + règles |

---

## 8. Système d'icônes véhicules

- **12 icônes** dans le sélecteur, toutes regroupées dans la fiche **Détail → « Icône du véhicule »** (désormais une **PAGE plein écran**, plus un pop-up) :
  - **9 dimensionnelles top-down** (PNG base64 embarqués, recolorables visuellement par leur propre palette) : `car, suv, van, pickup, truck, bus, moto, taxi, ambulance`.
  - **3 « sport »** : `sport` + les 2 illustrations **fournies par le client** `racingR` (rouge) / `racingY` (jaune).
- Structures : `VEH_ICONS` (clé → composant `Icon*`), `VEH_ICON_LIST` (ordre d'affichage), `VEH_ICON_LABELS` (libellés FR).
- **Conséquence design** : les icônes étant colorées (logique voulue par le client), **le statut ne se lit plus via la couleur de l'icône** mais via **l'anneau/la pastille de statut** autour du marqueur + le pulse lime en sélection. À respecter impérativement en prod.
- **En prod** : préférer des **SVG vectoriels** (plus nets, plus légers) plutôt que des PNG base64 ; sortir ces assets du bundle JS (fichiers `/assets`). Conserver les 2 illustrations du client.
- **`PlusGrid`** : icône custom (3 carrés arrondis + « + ») utilisée par le bouton **« Plus »** du popup carte (ouvre la fiche détail).

---

## 9. Backend GPS — décision d'architecture (Traccar vs custom)

### 9.1 Recommandation : **Traccar** comme cœur, API applicative en façade
- **Traccar** parle **GT06N** nativement (port dédié), ingère les trames, tient les devices, positions, géofences, événements, commandes et reports.
- **API applicative** (Node/Nest) : authentifie les clients de l'app, mappe devices↔clients (multi-tenant), gère le **partage par IMEI**, les **champs métier** (SIM, opérateur, ICCID, contact), l'i18n, la facturation, et **relaie** les commandes/positions vers/depuis Traccar (le mobile ne parle jamais à Traccar directement).
- **Base app (Supabase)** : `clients`, `devices` (miroir + champs métier), `device_shares`, `custom_geofences`, `notification_prefs`, `sim_billing`.

### 9.2 Serveur custom (alternative) — seulement si besoin de contrôle total
Écrire un parseur GT06N (TCP), un stockage positions, un moteur de règles (géofence, excès, tow, hors-horaires), un planificateur de commandes, et les reports. **Plus lourd** ; réserver si Traccar ne couvre pas un besoin précis (ex. commande propriétaire non standard, tarif SIM intégré).

### 9.3 Protocole & matériel
- Boîtiers : **GT06N** (protocole GT06). Attributs utiles : position, vitesse, cap, `ignition`(ACC), `battery`, `power`/tension, `sat`, `rssi` (GSM), `odometer`, alarmes (SOS, tow, low battery, power cut…).
- **Capteur carburant Bluetooth** : déjà déployé sur certaines flottes, **appairage via commande SMS**. Prévoir l'affichage d'un niveau carburant (non présent dans la maquette actuelle — extension possible).

### 9.4 Commandes (câbler `runCommand()` / `Cmd`)
| Action UI | Commande GT06N / Traccar | Notes |
|---|---|---|
| **Couper le moteur** | Coupure relais (oil/electricity) → Traccar `engineStop` | **Confirmée par mot de passe** dans l'UI. Sécurité : refuser si véhicule en mouvement rapide (avertir). |
| **Redémarrer le moteur** | `engineResume` | Idem mot de passe. |
| **Redémarrer le GPS** | commande reboot du boîtier | — |
| **Suivi en direct** | ouvre navigation Google Maps vers lat/lng | Pas une commande boîtier. |
| **Street View** | `google.com/maps/@?api=1&map_action=pano&viewpoint=lat,lng` | Déjà implémenté (bouton œil sur la carte). |

**Sémantique `runCommand()` (maquette)** : véhicule hors ligne → toast « GPS hors ligne — non transmise » ; sinon `pending` → si `gsm ≤ 1` → « Échec de l'envoi », sinon « Commande envoyée au boîtier ». En prod, remplacer par le **statut réel d'ACK** (commande envoyée / reçue par device / exécutée / échec) via Traccar (`commands` + événement de retour).

### 9.5 Géofences
`GeofenceScreen` : liste (zones + toggle + suppression) ↔ édition (cercle/polygone, rayon, nom, save). **Mapper** vers Traccar geofences + règles (notifications `geofenceEnter`/`geofenceExit`). Stocker aussi côté app pour l'UI (couleur, activation par utilisateur).

### 9.6 Alarmes & anomalies (moteur d'événements)
- **Événements** : mapper les événements Traccar (`deviceOverspeed`, `geofenceEnter/Exit`, `ignitionOn/Off`, `alarm` (tow/sos/powerCut/lowBattery)) vers les `ALARM_TYPES` (§6.2).
- **Anomalies** : calcul dérivé (pas des événements ponctuels) — dernier contact ancien (`disconnect`/`late`), alim coupée (`power`), batterie faible (`battery`/tension), GSM faible (`gsm`), perte GPS (`gps_lost`), forfait SIM épuisé (`sim` — nécessite données de facturation SIM). Statut agrégé par véhicule : `ok`/`check`/`problem`.
- **Push** : notifier les alarmes selon `notification_prefs` (toggle maître + par type, cf. `AlarmSettingsSheet`).

---

## 10. Surface API applicative suggérée

REST (façade, le mobile ne parle qu'à ça) :
```
POST /auth/login                    → session
GET  /me                            → compte (nom, tel, identifiant — lecture)
POST /me/password                   → changer mot de passe

GET  /vehicles                      → liste (view-model §6.1)
GET  /vehicles/:id                  → détail + santé
PATCH /vehicles/:id                 → éditer nom, SIM, n°SIM, icône, etc.
POST /vehicles                      → enrôler (IMEI, SIM…)
DELETE /vehicles/:id                → retirer (avec mot de passe)

POST /vehicles/:id/commands         → { type: engineStop|engineResume|gpsReboot } → ackId
GET  /commands/:ackId               → statut d'ACK

GET  /vehicles/:id/km?range=7d|30d|custom&from&to   → km/jour + totaux (+ par véhicule)
GET  /vehicles/:id/stats?day=       → activité (drive/idle/trips/stops/avg/max/over/days)
GET  /vehicles/:id/route?day=       → polyline + points playback

GET  /alarms?tab=events|anomalies   → événements / santé
GET  /alarms/:id                    → position d'une alarme (AlarmLocation)
GET  /notification-prefs / PATCH    → préférences

GET  /geofences / POST / PATCH / DELETE
POST /vehicles/:id/share            → { imei } → jeton/lien de partage (§12)
```
Temps réel : **WebSocket** `positions` (push des positions + événements). Reprendre le schéma view-model de §6.1 pour éviter tout remapping côté mobile.

---

## 11. Carte & Street View

- Remplacer la fausse carte (`MapScreen`, `MapGrid`, `SatLayer`, marqueurs px) par **Google Maps SDK** : marqueurs aux vraies lat/lng, icône = `iconFor(veh)`, **pastille/anneau de statut** autour, pulse lime sur l'actif, popup véhicule en bas (déjà maquetté : Nom + StatusPill, adresse, 4 tuiles Vitesse/Batterie/Connexion/État, date+heure, actions Suivi/Trajectoire/Plus).
- **Type de carte** : bascule Plan/Satellite (`mapType`), déjà dans l'UI (`MapTypeChooser`/`MapTypeToggle`).
- **Street View** : bouton œil (déjà câblé) → `map_action=pano&viewpoint=lat,lng`. Option : SDK Street View intégré.
- **Baidu** : le profil expose « Source carte : Google / Baidu ». Prévoir un abstract map-provider pour supporter Baidu (utile hors couverture Google).
- **Google Maps directions** : l'action « Suivi » ouvre l'itinéraire vers le véhicule.

---

## 12. Auth, permissions, partage d'appareil

> **Modèle de comptes — décision produit tranchée : HYBRIDE.** Deux voies coexistent :
> 1. **Compte créé manuellement par l'équipe Kelentane** (identifiant + mot de passe transmis au client).
> 2. **Auto-inscription** par le client lui-même, via le bouton **« Créer un compte »** sous le bouton de connexion (`LoginScreen` → `RegisterForm`).
>
> **Détails de l'auto-inscription (`RegisterForm`)** :
> - Champs : **Nom complet**, **Numéro de téléphone**, **Nom d'utilisateur**, **Mot de passe** (+ confirmation).
> - **Nom d'utilisateur auto-suggéré** = prénom (premier mot du nom complet) + **5 premiers chiffres** du numéro de téléphone, recalculé en temps réel tant que le champ n'a pas été modifié manuellement. Exemple exact validé : `Aliou DIOP` + `771234565` → `Aliou77123`. Fonction de référence dans la maquette : `suggestUsername(fullName, phone)`.
> - Le nom d'utilisateur reste **modifiable** par le client.
> - **Collision de nom d'utilisateur = BLOQUANT.** Si le nom d'utilisateur (suggéré ou modifié) existe déjà, l'inscription est bloquée avec un message inline (« Déjà pris — choisis un autre nom d'utilisateur »). **Pas de suffixe automatique** — le client doit choisir un autre nom lui-même. En prod : vérifier l'unicité via une requête à la table `clients`/`auth.users` (contrainte UNIQUE en base + vérification côté API avant `signUp`).
> - **Accès immédiat après inscription** — pas de validation manuelle par l'équipe. En prod : `supabase.auth.signUp()` suivi d'une connexion automatique (pas de flux de confirmation email/attente bloquante).
> - Démo maquette : liste `TAKEN_USERNAMES` en dur pour simuler la collision — à remplacer par une vraie vérification API en prod.
>
> **Conséquences pour l'implémentation (étape 9)** :
> - `LoginScreen` gère un état interne `view: "login" | "register"` — pas un écran séparé dans le routeur principal.
> - Pas d'écran de validation/approbation à construire (accès immédiat).
> - Prévoir une contrainte d'unicité sur le nom d'utilisateur côté Supabase (colonne `username` UNIQUE) + un endpoint ou une vérification côté client avant soumission pour un feedback rapide.
> - `LoginScreen` (connexion) couvre aussi **« mot de passe oublié »**, qui n'est pas un self-service reset par email : c'est une demande adressée à l'équipe, avec écran de confirmation, cf. `ForgotPasswordSheet`.
> - En prod, remplacer la logique démo de `LoginScreen`/`RegisterForm`/`ForgotPasswordSheet` par : `supabase.auth.signInWithPassword()` pour la connexion, `supabase.auth.signUp()` pour l'auto-inscription, et soit un flux admin interne pour le mot de passe oublié (créer le nouveau mot de passe manuellement et le transmettre), soit `supabase.auth.resetPasswordForEmail()` **si** un email est associé au compte — à trancher selon si les comptes ont un email ou seulement un identifiant/téléphone.
> - `SessionSplash` (écran de vérification au démarrage) doit être remplacé par un vrai check de session persistée (`supabase.auth.getSession()`), pour éviter de renvoyer un client déjà connecté à l'écran de connexion à chaque ouverture de l'app.
> - Le bouton **Déconnexion** (Profil) doit appeler `supabase.auth.signOut()` en plus de repasser l'état local `authStatus` à `"out"`.

- **Compte** (`ProfileScreen`) : Nom / Téléphone / Identifiant (actuellement lecture seule — décider si Nom/Téléphone deviennent éditables), changer mot de passe, langue, notifications, unités (km/mi), source carte, déconnexion.
- **Partage d'appareil** (`ShareImeiSheet`, volontairement minimal) : affiche l'**IMEI** + bouton **Copier**. En prod, transformer en **jeton/lien de partage** sécurisé (ne pas donner un accès complet juste avec l'IMEI en clair) : générer un `share_token` lié au device, avec portée (lecture seule / commandes) et expiration ; côté receveur, « ajouter un appareil partagé » via le jeton. Conserver l'UX ultra-simple demandée (un identifiant + Copier), mais côté backend, mapper IMEI→jeton.
- **Mot de passe des commandes sensibles** : coupure/redémarrage moteur exigent une confirmation par mot de passe (`PasswordSheet`). Câbler à une vérification réelle.
- **Multi-tenant** : un client ne voit que ses devices + ceux partagés avec lui. RLS Supabase.

---

## 13. Internationalisation

- `LanguageSheet` propose 10 langues (Français + English, 中文, हिन्दी, Español, العربية, বাংলা, Português, Русский, اردو). Défaut : **français**.
- En prod : extraire toutes les chaînes FR de la maquette vers des fichiers i18n (`fr` complet ; les autres à traduire). Prévoir le **RTL** pour العربية / اردو. Formats de dates/nombres localisés (la maquette utilise `toLocaleString("fr-FR")`).
- **Unités** : toggle km/mi (profil) → convertir vitesses/odomètre/km.

---

## 14. Liste exhaustive des données mockées à remplacer

Constantes en tête de `kelentane-gps-mockup.jsx` :
`VEHICLES` · `ALARM_TYPES` · `ALARM_EVENTS` · `DEVICE_HEALTH` · `KM_BY_VEHICLE` · `STATS_BY_VEHICLE` · `DAYS` · `DATES` · `PLAYBACK` · `ROUTE_D` · `TRAJ` · `STATUS_LABEL` · `NOW` (date figée `2026-06-29`) · les `IMG_*` (icônes base64).
Helpers à conserver mais brancher sur du réel : `relAgo()`, `fmtDT()`, `freshColor()`, `iconFor()`.

> ⚠️ `NOW` est une date figée pour cohérence de la maquette. En prod, utiliser l'heure réelle. Tous les « il y a X min », statuts de fraîcheur et couleurs en dépendent.

---

## 15. Inventaire des écrans (comportements à répliquer)

- **MapScreen** (`map`) : carte + 4 marqueurs (pastille couleur statut, icône blanche/colorée, pulse lime sur actif). Barre de marque (wordmark `kelentane` + monogramme K lime). Contrôles : Couches (type carte), **Street View** (œil), zoom +/−. Popup véhicule (Nom+StatusPill, adresse + info, 4 tuiles Vitesse/Batterie/Connexion[En ligne/Hors ligne]/État[En route/Arrêté], date+heure, actions Suivi[primaire→Google Maps]/Trajectoire/**Plus**[PlusGrid→détail]).
- **ListScreen** (`list`) : recherche fonctionnelle (nom/plaque/adresse, clear, état vide), header « + » (AddDeviceSheet). Ligne : tap→détail ; **appui long ~550ms**→PasswordSheet « Supprimer {nom} »→retire. Appareils ajoutés persistent (état `added`).
- **DetailScreen** (`detail`, `key={active.id}`) : header nom (DISPLAY, éditable). Métriques. Grille commandes : **Couper moteur** + **Redémarrer moteur** (mot de passe), **Suivi en direct** (Google Maps), **Redémarrer GPS**, **Géofence**, **Kilométrage**. Carte « Détails du dispositif » : nom (éditable), IMEI/Modèle/ACC/plaque/batterie/tension/GSM/sats/odo/intervalle, **Icône du véhicule** (→ page sélecteur), Carte SIM (éditable), N° SIM (éditable), ICCID, contact.
- **GeofenceScreen** (`geo`) : liste zones (toggle/suppr + « + ») ↔ édition (cercle/polygone + rayon + nom + save).
- **StatsScreen** (`stats`, onglet) : sélecteur de date (1 jour), gros km, barres km/jour, résumé hebdo (total/moy/max), **répartition d'activité** (réservée ici).
- **KmScreen** (`km`, depuis la fiche) : intervalle **7 jours / 30 jours / Perso** (RangePickerSheet : 1er jour → dernier jour), total sur intervalle + ≈km/jour, barres km/jour, **total par véhicule**. **Sans** répartition d'activité.
- **TrajectoryScreen** (`traj`) : playback animé, polyline, play/pause + scrubber + vitesse, lecture live (couleur mouvement = ONLINE), toggles, pastille date.
- **ProfileScreen** (`me`) : compte, partage d'appareil (IMEI+Copier), changer mot de passe, langue, notifications, unités, source carte, déconnexion.
- **AlarmsScreen** (`alarm`) : 2 onglets **Alarmes**(événements) / **Anomalies**(santé, badge rouge). Défaut intelligent : ouvre Anomalies s'il y en a d'actives. Toggle notifications maître. Anomalies = cartes santé (OK/À vérifier/Problème, dépliables → cause + action). Alarmes = liste cliquable (« Voir »→AlarmLocation). Engrenage → AlarmSettingsSheet (groupé Alarmes/Anomalies).
- **AlarmLocationScreen** (`alarmloc`) : carte + marqueur rouge + popup blanc (Nom/Statut/Signal/Temps).
- **LoginScreen** (nouveau, ajouté après coup — pas de screen `login` dans l'état `screen`, c'est un **gate** au niveau racine via un état `authStatus: "checking"|"out"|"in"`) : logo K + wordmark, champ **Identifiant** (`UserRound`) + **Mot de passe** (`KeyRound`, masqué), erreur inline si échec, bouton **Se connecter** (désactivé tant que les 2 champs ne sont pas remplis), lien **« Mot de passe oublié ? »** → `ForgotPasswordSheet`. Mention explicite en bas d'écran : **pas d'auto-inscription** — « les accès sont créés par notre équipe ». **`SessionSplash`** s'affiche pendant `authStatus === "checking"` (vérification de session au démarrage). Le bouton **Déconnexion** du Profil (`ProfileScreen`, sheet de confirmation `bye`) est câblé sur `onLogout` → repasse `authStatus` à `"out"`, ce qui recouvre l'app entière (toutes les branches d'écran sont gated par `authStatus === "in" &&`).
- **ForgotPasswordSheet** (nouveau) : pas de flux self-service de reset — le sheet collecte l'identifiant et affiche une confirmation « L'équipe Kelentane te contactera avec un nouveau mot de passe ». Reflète la décision produit : **comptes créés manuellement par l'équipe**, pas de self-signup.
- **IconPicker** (page) : grille 3 colonnes, 12 icônes + libellés, coche sur l'active, défilement.

---

## 16. Points de vigilance / dette connue

- La `type` du véhicule (`van/truck/bus/car`) et l'`icon` par défaut ne sont pas toujours alignées dans le mock (ex. « van » avec icône truck). Aligner en prod : icône par défaut dérivée de `type`.
- `SubUsersSheet` existe encore mais est **inutilisé** (remplacé par `ShareImeiSheet`). À supprimer au découpage.
- Le `PLAYBACK`/`ROUTE_D` sont des données de démo ; la vraie polyline vient des reports.
- Icônes en **base64 dans le JS** : à externaliser en assets SVG.
- Seuils de fraîcheur (10 min / 24 h) codés en dur dans `freshColor()` : externaliser en config.

---

## 17. Checklist de démarrage Claude Code

1. [ ] Scaffolder l'app (RN/PWA) + le design system (§4) en tokens.
2. [ ] Découper le mockup en composants (§5) — commencer par `/ui` et `/theme`.
3. [ ] Stand-up Traccar (test) + API façade + Supabase (schéma §9.1).
4. [ ] Brancher **liste + carte** sur positions réelles (WebSocket) → view-model §6.1.
5. [ ] Fiche détail : édition persistée + commandes réelles (ACK) (§9.4).
6. [ ] Alarmes/anomalies + push (§9.6).
7. [ ] Km / Stats / Trajet via reports Traccar (§6.5/6.6).
8. [ ] Géofences CRUD + règles (§9.5).
9. [ ] Partage par jeton (§12), auth, mot de passe commandes.
10. [ ] i18n (§13), unités, source carte Baidu.
11. [ ] Externaliser icônes en SVG (§8).

---

---

## Annexe A — Détails techniques exacts (copier tel quel)

### A.1 Polices — lien à réinjecter à l'identique
```
https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;600;700;800;900&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap
```
Stacks CSS exacts :
```
DISPLAY = 'Big Shoulders Display', 'IBM Plex Sans', sans-serif
BODY    = 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif   // police racine
MONO    = 'IBM Plex Mono', ui-monospace, monospace
```

### A.2 Tokens couleur exacts (à mettre en variables)
```
LIME #D4FF17 · LIME_ON #15210A · TEAL/ONLINE #36D399 · PARKED #FFB14E · OFFLINE #8E8E93 · ALERT #FF5C5C
Sombre : bg #06080F · text #FFFFFF · sub rgba(255,255,255,0.58) · accent #D4FF17
         glass rgba(255,255,255,0.07) · glassSolid rgba(20,24,34,0.78)
         border rgba(255,255,255,0.14) · line rgba(255,255,255,0.09)
Clair  : bg #DFE7F0 · text #0A0C14 · sub rgba(10,12,20,0.55) · accent #4F6B00
         glass rgba(255,255,255,0.55) · glassSolid rgba(255,255,255,0.86)
```

### A.3 Traccar — points concrets pour GT06N
- **Protocole** : `gt06` — port TCP par défaut **5023** (à configurer dans `traccar.xml` / `conf`).
- **Enrôler un boîtier** : device Traccar avec `uniqueId` = **IMEI** du boîtier (le n° imprimé, aussi utilisé pour le partage).
- **Commandes** (`POST /api/commands`, `type`) : `engineStop` (couper moteur), `engineResume` (redémarrer moteur), `rebootDevice`/commande reboot (redémarrer GPS). Certaines exigent la config du canal (GPRS actif) ; fallback SMS possible via le n° SIM du boîtier (`phone`).
- **Temps réel** : WebSocket `GET /api/socket` (positions + events) — à relayer par l'API façade, jamais exposé au mobile.
- **Historique / reports** : `/api/reports/route`, `/reports/trips`, `/reports/stops`, `/reports/summary`, `/reports/events` (formats JSON).
- **Positions / devices / géofences** : `/api/positions`, `/api/devices`, `/api/geofences`.
- **Attributs position utiles** → mapping §6.1 : `battery`, `power`/`voltage`, `ignition`(→acc), `sat`, `rssi`(→gsm /5), `odometer`, `distance`, `alarm` (sos/tow/powerCut/lowBattery), `blocked`, `valid`(fix GPS ; absence ⇒ LBS).

### A.4 Lancer / prévisualiser la maquette en standalone
- Dépendances : `react`, `react-dom`, `lucide-react@0.383.0` (version runtime — ne pas changer sans revérifier les noms d'icônes).
- Bundler avec le loader JSX (`--jsx=automatic`). La maquette n'utilise **aucun** stockage navigateur (contrainte d'artefact) : en production, `localStorage`/persistances redeviennent disponibles (préférence thème, langue, unités, dernier véhicule).
- La bascule light/dark et le cadre téléphone sont **présentationnels** : à retirer/remplacer par le vrai chrome de l'app.

### A.5 Reachabilité de navigation (vérifiée)
Onglets TabBar : `map` (Carte), `list` (Véhicules), `alarm` (Alarmes), `stats` (Stats), `me` (Profil). Écrans internes atteints depuis la fiche/carte : `detail`, `geo`, `km`, `traj`, `alarmloc`. **Toutes les cibles `setScreen` ont un écran** (vérifié : aucune cible orpheline).

### A.6 Statut de vérification de ce livrable
- Build esbuild : **OK**. Scan statique : **0 composant/icône manquant**, **0 cible de navigation orpheline**, **0 clé d'icône non mappée**.
- Affirmations de ce document confrontées au code source : **exactes** (tokens, seuils `freshColor` 10 min/24 h, logique `runCommand`, appui long 550 ms, `SubUsersSheet` non rendu, « Plus » = `PlusGrid`, sélecteur d'icônes en page).

---

*Fin du document. Référence visuelle et comportementale : `kelentane-gps-mockup.jsx`.*
