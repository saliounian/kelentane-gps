# AUDIT — Plateforme Kelentane GPS

> Audit statique lecture seule. Aucun correctif appliqué, aucun fichier source modifié.
> Date : 2026-07-16 · Branche auditée : `feat/adopt-pin-profond-theme` · HEAD `f0c7111`.
> Commande d'audit : staff engineer + auditeur sécurité senior. Verdict brut, sans réassurance.

---

## 1. Résumé exécutif

La plateforme est **bien structurée sur le papier** (façade NestJS, RLS Supabase, RPC
`SECURITY DEFINER`, isolation multi-tenant appliquée à la source dans le WebSocket, couche
d'erreurs centralisée). La plupart des bugs historiques listés sont **effectivement corrigés**.

Mais l'audit remonte **trois failles CRITIQUES** qui, combinées, permettent à un attaquant
connaissant simplement un **IMEI** (imprimé sur le boîtier, non secret) de **prendre le contrôle
d'un véhicule** — jusqu'à la coupure moteur — et le tout transite en **HTTP clair**.

Le cœur métier (modèle d'accès) tient globalement côté lecture, mais **les gardes de rôle
`consultation` ne sont pas appliquées sur les endpoints d'écriture** (géofences, partages,
métadonnées) : un compte en consultation peut écrire. Et le contrôle d'accès RLS repose encore
sur une fonction (`has_device_access`) **écrite avant le modèle `device_access`** — elle ignore
la table qui fait désormais autorité.

### Décompte par sévérité

| Sévérité | Nombre |
|---|---|
| 🔴 CRITIQUE | 3 |
| 🟠 ÉLEVÉ | 4 |
| 🟡 MOYEN | 7 |
| 🔵 FAIBLE | 8 |
| ⚪ INFO | 4 |
| **Total** | **26** |

**Verdict** : **NON prêt pour une exposition prod élargie / version web** tant que C1–C3 et H1–H3
ne sont pas traités. En l'état, l'app fonctionne pour une démo/pilote contrôlé, mais le modèle de
sécurité repose sur l'obscurité de l'IMEI et sur un mot de passe device par défaut (`123456`)
jamais forcé au changement — ce n'est pas une barrière.

---

## 2. Findings

### 🔴 CRITIQUES

---

**[C1] Tout le trafic mobile ↔ API circule en HTTP clair (tokens, mots de passe device, positions)**

- **Sévérité** : CRITIQUE
- **Zone** : Sécurité / Infra / Transport
- **Localisation** : `src/config/env.ts:15`, `app.json:12-16` (ATS iOS off), `app.json:42-47`
  (`usesCleartextTraffic:true`), `api/src/main.ts:7`, `docs/DEPLOY.md:118-122`.
- **Description** : `API_URL` par défaut = `http://31.97.176.235:3000` (IP nue, pas de TLS). iOS
  `NSAllowsArbitraryLoads:true` et Android `usesCleartextTraffic:true` désactivent explicitement la
  protection transport. Aucun reverse-proxy HTTPS n'est en place (documenté comme « à faire avant
  prod »).
- **Cause racine** : déploiement démo « IP + HTTP » jamais migré vers domaine + TLS ; exceptions
  cleartext embarquées dans le build.
- **Preuve** : `export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://31.97.176.235:3000";`
  et `body: JSON.stringify({ imei, devicePassword })` (`src/data/api.ts:108`) → le mot de passe du
  dispositif part en clair. Le `Authorization: Bearer <JWT Supabase>` (`src/data/authHeader.ts`)
  part en clair sur **chaque** requête.
- **Impact** : un attaquant sur le même réseau (Wi-Fi public, opérateur, point d'accès pirate) capture
  les JWT de session (→ usurpation complète du compte), les mots de passe device (→ ajout d'accès),
  et l'intégralité des **positions clients** en clair.
- **Scénario** : MITM passif sur un réseau partagé → rejoue le Bearer token → lit `/vehicles`,
  envoie des commandes.
- **Correctif recommandé** : domaine + reverse-proxy TLS (Caddy/Nginx + Let's Encrypt), pointer
  `EXPO_PUBLIC_API_URL` sur `https://…`, **retirer** `NSAllowsArbitraryLoads` et
  `usesCleartextTraffic`, forcer HSTS. Rebuild EAS.
- **Effort** : M
- **Vérification** : Confirmé statiquement.

---

**[C2] `POST /vehicles` (enroll) adopte n'importe quel IMEI SANS mot de passe device → prise de contrôle**

- **Sévérité** : CRITIQUE
- **Zone** : Sécurité / Backend / Contrôle d'accès
- **Localisation** : `api/src/vehicles/vehicles.service.ts:74-98`, `api/src/vehicles/vehicles.controller.ts:82-94`,
  `api/src/supabase/devices.service.ts:78-82` (`existsByImei`).
- **Description** : le endpoint d'enrôlement est protégé par `AuthGuard` **seul** (aucun rôle admin).
  `existsByImei` ne vérifie que la table applicative `devices`, **pas** la flotte Traccar. Si un
  device réel existe dans Traccar mais n'a pas encore de ligne dans `public.devices` (auto-détection,
  boîtiers backfillés, nouveau boîtier), `enroll` le retrouve via `devices.find(d => d.uniqueId === imei)`,
  réutilise son `traccar_id`, crée la ligne `owner_id = attaquant` et lui accorde un accès **`action`** —
  **le tout sans jamais demander le mot de passe du dispositif**.
- **Cause racine** : le chemin `enroll` (pensé « admin / auto-détection ») fait autorité sur l'IMEI seul,
  alors qu'il est exposé à tout compte authentifié. La vérification d'existence porte sur la mauvaise
  source (base app au lieu de Traccar).
- **Preuve** :
  ```ts
  if (await this.devices.existsByImei(imei)) throw ...CONFLICT;      // ne teste que public.devices
  const { devices } = await this.traccar.getFleet();
  const existing = devices.find((d) => d.uniqueId === imei);          // trouvé dans Traccar
  if (existing) traccarId = existing.id;                              // adopté sans mot de passe
  const row = await this.devices.insertOwned(userId, imei, traccarId, { name: label });
  if (row) await this.devices.insertAccess(row.id, userId, "action");
  ```
- **Impact** : contournement total de la barrière « mot de passe device » du chemin `addAccess`. Un
  attaquant authentifié + un IMEI = propriété + accès action (commandes) sur un véhicule qui ne lui
  appartient pas.
- **Scénario** : l'attaquant connaît un IMEI, appelle `POST /vehicles {imei}`. Si le device n'est pas
  encore dans `public.devices` → il en devient propriétaire.
- **Correctif recommandé** : réserver `enroll` à un rôle admin serveur (pas `AuthGuard` générique) OU
  exiger le mot de passe device aussi sur l'enrôlement d'un IMEI déjà présent côté Traccar ; faire
  porter `existsByImei` sur Traccar **et** la base app.
- **Effort** : M
- **Vérification** : Confirmé statiquement.

---

**[C3] Mot de passe device + compte walk-up = `123456` par défaut, jamais forcé → coupure moteur à distance**

- **Sévérité** : CRITIQUE
- **Zone** : Sécurité / Produit / Device
- **Localisation** : `infra/supabase/migrations/0005_device_password_transfer.sql:16-21` (défaut `123456`),
  `api/src/supabase/accounts.service.ts:11` (`DEFAULT_DEVICE_PASSWORD = "123456"`),
  `api/src/commands/commands.service.ts:37-40`.
- **Description** : tout device a `device_password` = `123456` par défaut (hashé bcrypt), changement
  **non obligatoire**. Le compte walk-up IMEI est créé avec le **même** mot de passe `123456`. L'IMEI
  n'est pas un secret (imprimé sur le boîtier, visible sur la SIM, énumérable). Le rate-limit (5 essais
  / 15 min) ne protège pas un mot de passe **connu**.
- **Cause racine** : secret partagé par défaut identique et public, sans rotation forcée, sur un
  identifiant non secret.
- **Preuve** : `addAccess` accepte `123456` (`device_add_access` compare `crypt(p_password, device_password)`) ;
  puis login walk-up `imei@kelentane.com` / `123456` réussit ; puis `engineStop` exige le mot de passe
  **du compte** = `123456` (`verifyPassword(email,'123456')` → OK).
- **Impact** : immobilisation à distance d'un véhicule (coupure moteur) par toute personne connaissant
  l'IMEI, si le mot de passe device n'a pas été changé — c'est le cas par défaut.
- **Scénario** : IMEI relevé sur le boîtier → `addAccess(imei,'123456')` → login `imei/123456` →
  `engineStop` avec password `123456`.
- **Correctif recommandé** : forcer le changement du mot de passe device au premier accès (ou générer
  un secret aléatoire par device à l'usine/enrôlement) ; dissocier le mot de passe du compte walk-up du
  mot de passe device ; imposer une politique de complexité ; envisager un 2ᵉ facteur pour les commandes
  sensibles.
- **Effort** : L
- **Vérification** : Confirmé statiquement.

---

### 🟠 ÉLEVÉS

---

**[H1] Le rôle `consultation` peut ÉCRIRE (géofences, partages, métadonnées) — garde d'action manquante**

- **Sévérité** : ÉLEVÉ
- **Zone** : Sécurité / Backend / Autorisation
- **Localisation** : `api/src/geofences/geofences.service.ts:39,124` (`assertImei`),
  `api/src/shares/shares.service.ts:33` (`assertImei`), `api/src/vehicles/vehicles.service.ts:41`
  (patch → `assertImei`). Comparer à `commands.service.ts:50` qui utilise bien `assertAction`.
- **Description** : `AccessService` expose `assertImei` (accès actif, n'importe quel rôle) et
  `assertAction` (rôle `action` requis). Seul l'envoi de commandes utilise `assertAction`. La
  création/suppression de géofences, la création de jetons de partage et le PATCH des champs métier
  n'exigent que `assertImei` → un sous-compte `consultation` (censé être lecture seule, §4) peut créer
  et supprimer des géofences, générer des liens de partage (exfiltration) et modifier les métadonnées.
- **Cause racine** : garde de rôle appliquée par endpoint de manière incohérente ; le périmètre
  `consultation` n'est pas réellement en lecture seule côté serveur.
- **Preuve** : `this.access.assertImei(allowed, d.uniqueId);` dans `geofences.create` et `shares.create`
  au lieu de `assertAction`.
- **Impact** : escalade fonctionnelle consultation → écriture. Un employé en consultation peut
  désactiver une géofence de surveillance ou émettre un partage lecture vers un tiers.
- **Scénario** : sous-compte consultation → `POST /vehicles/:id/share` → jeton → partage la position à
  l'extérieur.
- **Correctif recommandé** : remplacer `assertImei` par `assertAction` sur toute écriture (géofences
  create/patch/delete, shares create, vehicle patch, device-password déjà à revoir cf. H2).
- **Effort** : S
- **Vérification** : Confirmé statiquement.

---

**[H2] Changer le mot de passe device n'exige PAS d'être propriétaire → lockout/griefing du vrai propriétaire**

- **Sévérité** : ÉLEVÉ
- **Zone** : Sécurité / DB / Produit
- **Localisation** : `infra/supabase/migrations/0007_device_access_model.sql:86-106` (redéfinit
  `device_set_password`), vs `0005:53-68` (ancienne version « owner uniquement »).
  Contrôleur : `api/src/vehicles/vehicles.controller.ts:96-114` (commentaire « propriétaire » erroné).
- **Description** : la 0007 remplace `device_set_password` : elle n'exige plus `owner_id = p_owner`
  mais seulement un **accès actif** au device. Or, changer le mot de passe déclenche la révocation
  douce (`status='revalidate'`) de **tous les autres** accès. Donc n'importe quel compte coexistant
  (y compris le walk-up `123456`) peut changer le mot de passe et forcer le vrai propriétaire à
  revalider.
- **Cause racine** : assouplissement de la garde entre 0005 et 0007 sans réévaluer le pouvoir de
  révocation associé ; l'UI/commentaire disent encore « propriétaire ».
- **Preuve** :
  ```sql
  if not exists (select 1 from public.device_access
    where device_id = d.id and user_id = p_owner and status = 'active') then return false; end if;
  update public.device_access set status = 'revalidate' where device_id = d.id and user_id <> p_owner;
  ```
- **Impact** : déni d'accès entre comptes coexistants ; combiné à C3, un attaquant walk-up verrouille
  le propriétaire légitime.
- **Scénario** : attaquant ajoute l'accès via `123456`, change le mot de passe device → le propriétaire
  passe `revalidate` et perd la vue temps réel jusqu'à re-saisie.
- **Correctif recommandé** : décider explicitement du modèle : soit réserver le changement de mot de
  passe device au **premier accès / propriétaire d'origine** (réintroduire `owner_id`), soit exiger le
  mot de passe device **courant** pour le changer. Corriger le commentaire trompeur.
- **Effort** : M
- **Vérification** : Confirmé statiquement.

---

**[H3] La RLS repose sur `has_device_access` (owner + shares), qui IGNORE la table `device_access`**

- **Sévérité** : ÉLEVÉ
- **Zone** : Sécurité / DB (RLS)
- **Localisation** : `0001:49-53` puis `0002:5-9` (`private.has_device_access`) ; la 0007 introduit
  `device_access` mais **ne met pas à jour** cette fonction ni les policies `devices_select`,
  `geo_select`, `sim_select`.
- **Description** : après la 0007, l'accès fait autorité via `device_access`. Mais la fonction RLS ne
  regarde que `devices.owner_id = auth.uid()` **ou** `device_shares.shared_with = auth.uid()`. Elle
  ignore `device_access`. Aujourd'hui l'impact direct est limité car le mobile lit tout via l'API
  (service_role, qui bypasse la RLS) et ne lit en direct que sa propre ligne `clients`. Mais :
  1. la RLS est **désynchronisée du modèle métier** (dette dangereuse) ;
  2. pour la **future version web** qui lira `devices`/`custom_geofences` en direct avec la clé
     publishable, un compte à accès `device_access` (mais non owner/non share) sera **injustement
     privé de lecture**, et surtout la policy `devices_select` autorise le **propriétaire** à lire la
     ligne `devices` entière — **colonne `device_password` (hash bcrypt de `123456`) comprise** —
     puisque la RLS est par ligne, pas par colonne.
- **Cause racine** : migration 0007 incomplète — nouveau modèle d'accès non répercuté sur la couche RLS.
- **Preuve** : `private.has_device_access` inchangée depuis 0002 ; aucune référence à `device_access`
  dans les policies de 0001/0002.
- **Impact** : barrière RLS non alignée ; risque d'exposition du hash device et de rupture d'accès dès
  qu'un client parle en direct à Supabase (web à venir).
- **Scénario** : client web `supabase.from('devices').select('device_password')` sur un device possédé →
  récupère le hash → crack offline trivial de `123456`.
- **Correctif recommandé** : réécrire `has_device_access` pour inclure `device_access` (status actif) ;
  retirer/masquer `device_password` de toute lecture client (colonne dans un schéma privé ou vue sans
  ce champ, revoke SELECT sur la colonne) **avant** d'exposer un client direct.
- **Effort** : M
- **Vérification** : Confirmé statiquement (impact web = À vérifier lors de la conception web).

---

**[H4] CORS ouvert à toutes origines + pas de TLS, en vue de la version web**

- **Sévérité** : ÉLEVÉ (contexte web) / MOYEN (mobile seul)
- **Zone** : Sécurité / Transport
- **Localisation** : `api/src/main.ts:7` (`app.enableCors()` sans options), `WebSocketGateway({ cors:{ origin:"*" }})`
  (`positions.gateway.ts:25`).
- **Description** : CORS totalement ouvert (`*`). Acceptable pour un mobile natif (pas de politique
  d'origine), mais dès qu'un front web sur navigateur consommera l'API, `origin:"*"` + absence de TLS
  ouvre le vol de session cross-site et empêche `credentials`.
- **Cause racine** : configuration « ouverte par défaut » jamais restreinte.
- **Preuve** : `app.enableCors();` sans liste blanche.
- **Impact** : surface d'attaque CSRF/XS-leak pour le web futur.
- **Correctif recommandé** : liste blanche d'origines explicite via env ; TLS obligatoire ; cookies
  `SameSite` si sessions navigateur.
- **Effort** : S
- **Vérification** : Confirmé statiquement.

---

### 🟡 MOYENS

---

**[M1] Régression : fuite de messages d'erreur bruts en UI (contourne `toUserMessage`)**

- **Sévérité** : MOYEN
- **Zone** : Frontend
- **Localisation** : `src/screens/ProfileScreen.tsx:160,199,256,271`, `src/screens/AuthScreen.tsx:96,178`,
  `src/screens/TrajectoryScreen.tsx:82`, `src/screens/AlarmsScreen.tsx:45`.
- **Description** : la couche `errorMessages.ts` impose d'afficher `toUserMessage(err)`. Plusieurs
  écrans affichent directement `(e as Error).message` ou `error.message` de Supabase :
  - `ProfileScreen` → messages **GoTrue/Postgres en anglais** bruts (changement de mot de passe, mise à
    jour du téléphone) affichés à un utilisateur francophone.
  - `ShareSheet` / `TrajectoryScreen` / `AlarmsScreen` → affichent le **détail technique** porté par
    `ApiError.message` (ex. `HTTP 404`, `HTTP 502`, ou le libellé réseau brut), puisque `statusError`
    met `technical = "HTTP <status>"`.
- **Cause racine** : adoption incomplète de la couche d'erreurs ; certains écrans n'ont jamais été
  migrés vers `toUserMessage`. C'est la **même classe** que le bug « NoRouteToHostException en UI »
  réputé corrigé.
- **Preuve** : `setMsg(error ? error.message : …)` (Profile), `setError((e as Error).message)` (Auth,
  Trajectory, Alarms). Les écrans « propres » utilisent bien `toUserMessage` (ListScreen, KmScreen,
  StatsScreen, GeofenceScreen, DetailScreen).
- **Impact** : fuite de termes techniques/anglais, incohérence UX, l'objectif produit « aucun message
  technique en UI » est violé.
- **Correctif recommandé** : remplacer partout `.message` d'erreur affiché par `toUserMessage(e)` ;
  pour les appels Supabase directs (Profile), mapper l'`AuthError`/`PostgrestError` via `toUserMessage`.
- **Effort** : S
- **Vérification** : Confirmé statiquement.

---

**[M2] `enroll` est un oracle d'énumération d'IMEI (409 vs 201)**

- **Sévérité** : MOYEN
- **Zone** : Sécurité
- **Localisation** : `api/src/vehicles/vehicles.service.ts:76-81`.
- **Description** : `addAccess` et `imei-login` renvoient une erreur générique unique (anti-énumération,
  bon). Mais `enroll` renvoie **409 « Ce dispositif existe déjà »** si l'IMEI est en base, et réussit
  sinon → oracle binaire d'existence, sur un chemin authentifié.
- **Cause racine** : message distinctif de conflit sur un chemin non aligné avec la politique
  anti-énumération.
- **Impact** : un attaquant authentifié énumère quels IMEI sont enregistrés (couplé à C2, il sait
  lesquels sont adoptables).
- **Correctif recommandé** : uniformiser la réponse (message générique) ou fusionner enroll/addAccess
  derrière la même politique ; réserver enroll à l'admin (cf. C2).
- **Effort** : S
- **Vérification** : Confirmé statiquement.

---

**[M3] Jetons de partage à faible entropie, sans expiration, `claim` non rate-limité**

- **Sévérité** : MOYEN
- **Zone** : Sécurité / Produit
- **Localisation** : `api/src/shares/shares.service.ts:22-24` (`randomBytes(4)` = 32 bits),
  `expires_at` jamais renseigné (`0001:43`), `claim` sans rate-limit.
- **Description** : token `KLN-<8 hex>` = 2³² possibilités, jamais expiré. `claim` ne limite pas les
  tentatives. Un balayage peut réclamer un partage aléatoire → accès lecture à un véhicule d'un tiers.
- **Cause racine** : entropie et cycle de vie du jeton non dimensionnés pour une ressource sensible.
- **Impact** : accès non autorisé aux positions par force brute du jeton (aggravé par l'absence de TLS).
- **Correctif recommandé** : token ≥ 128 bits (`randomBytes(16)`), `expires_at` obligatoire, rate-limit
  sur `claim`, invalidation après usage.
- **Effort** : S
- **Vérification** : Confirmé statiquement.

---

**[M4] Port Traccar 8082 (UI + API REST) exposé publiquement en clair**

- **Sévérité** : MOYEN
- **Zone** : Infra / Device
- **Localisation** : `infra/traccar/docker-compose.yml:16` (`8082:8082`), `docs/DEPLOY.md:86`
  (`ufw allow 8082/tcp`).
- **Description** : l'UI/API admin Traccar est publiée sur `0.0.0.0:8082` en HTTP clair et le pare-feu
  l'autorise. Si les identifiants admin par défaut n'ont pas été changés, c'est un contrôle total du
  cœur GPS. Le principe « Traccar jamais exposé » (docs) n'est pas respecté au niveau réseau.
- **Cause racine** : port publié pour le confort d'admin, jamais restreint.
- **Impact** : accès direct au cœur GPS hors façade ; brute-force admin en clair.
- **Correctif recommandé** : ne pas publier 8082 publiquement (bind `127.0.0.1` + tunnel SSH, ou VPN),
  fermer `ufw` 8082, TLS, vérifier que l'admin par défaut a été changé.
- **Effort** : S
- **Vérification** : À vérifier en prod (commandes en annexe).

---

**[M5] Rate-limiting absent hors login/ajout IMEI (commandes, vérif mot de passe compte, login username)**

- **Sévérité** : MOYEN
- **Zone** : Sécurité / Backend
- **Localisation** : `commands.service.ts:38` (`verifyPassword` sans limite applicative),
  `vehicles.controller.ts:124` (delete → `verifyPassword`), login username `state/auth.tsx:70` (direct
  GoTrue). Pas de `@nestjs/throttler` dans `api/package.json`.
- **Description** : le rate-limit maison ne couvre que l'IMEI (login + addAccess). La vérification du
  mot de passe **compte** (commandes sensibles, suppression) se fait par `signInWithPassword` éphémère,
  sans limite applicative (seule la limite GoTrue s'applique, par IP). Aucun throttling global NestJS.
- **Cause racine** : rate-limit conçu ponctuellement pour l'IMEI, pas généralisé.
- **Impact** : brute-force du mot de passe compte pour déclencher des commandes ; abus non plafonné.
- **Correctif recommandé** : `@nestjs/throttler` global + limites ciblées sur `/commands`, delete,
  et le login username.
- **Effort** : M
- **Vérification** : Confirmé statiquement.

---

**[M6] Absence de validation de DTO (`class-validator` non installé)**

- **Sévérité** : MOYEN
- **Zone** : Backend
- **Localisation** : `api/package.json` (ni `class-validator` ni `class-transformer` ni
  `ValidationPipe` global dans `main.ts`).
- **Description** : toutes les entrées sont typées `interface` (effacées à l'exécution) et validées à la
  main de façon inégale (`ParseIntPipe` par-ci, regex IMEI par-là). Pas de `ValidationPipe`
  `whitelist/forbidNonWhitelisted`. Risque de payloads inattendus, de champs superflus persistés, et
  d'incohérences de contrat.
- **Cause racine** : NestJS utilisé sans sa couche de validation standard.
- **Impact** : robustesse et sécurité d'entrée dégradées (mass-assignment limité ici car les patchs
  sont mappés champ à champ, mais fragile).
- **Correctif recommandé** : DTO `class-validator` + `ValidationPipe({ whitelist:true, transform:true })`.
- **Effort** : M
- **Vérification** : Confirmé statiquement.

---

**[M7] Dérive de déploiement VPS non vérifiable statiquement (et build depuis une branche)**

- **Sévérité** : MOYEN
- **Zone** : Infra / DevOps
- **Localisation** : prod VPS `31.97.176.235` ; repo `origin/main`. Branche courante auditée =
  `feat/adopt-pin-profond-theme` (non fusionnée).
- **Description** : le déploiement est manuel (`git pull` + `docker compose up --build`), sans CI/CD.
  Impossible de confirmer statiquement que `HEAD` du VPS == `origin/main`. Le bug historique (backend
  40+ commits en retard) ne peut être exclu qu'avec une commande sur le VPS.
- **Cause racine** : pas de pipeline ni de garde de version au déploiement.
- **Impact** : risque que la prod tourne un code différent de l'audité.
- **Correctif recommandé** : CI/CD ou au minimum un script de déploiement qui logge `git rev-parse HEAD`
  et refuse un déploiement hors `main` ; healthcheck versionné (exposer le SHA sur `/health`).
- **Effort** : M
- **Vérification** : À vérifier en prod (commande en annexe).

---

### 🔵 FAIBLES

- **[L1] Code mort `TabBar.tsx`** exporté par `src/ui/index.ts:13` et jamais utilisé (la vraie barre est
  `AppTabBar`). Metro ne tree-shake pas agressivement → embarqué au bundle. *(Frontend, S)*
- **[L2] RPC `device_transfer` (0005) orpheline** : `transferByImei` retiré du code TS, mais la fonction
  `SECURITY DEFINER` reste en base (surface inutile). *(DB, S)*
- **[L3] `mergeRow` expose `owner_id`** (UUID du propriétaire) dans le VM renvoyé au mobile
  (`vehicle.mapper.ts:97`) — fuite d'identifiant interne, non nécessaire à l'UI. *(Frontend/Backend, S)*
- **[L4] `google-services.json` non ignoré** : présent dans l'arbo, non listé dans `.gitignore` (seul
  `fcm-service-account.json` l'est) → risque de commit accidentel. *(Infra, S)*
- **[L5] Fenêtre de révocation temps réel ≤ 60 s** : `PositionsGateway` re-résout le périmètre toutes les
  60 s (`ALLOWED_REFRESH_MS`) ; un accès révoqué continue de recevoir des positions jusqu'à 60 s.
  *(Backend, S)*
- **[L6] Conteneur API en root** : `Dockerfile` `node:22-alpine` sans `USER node` ; pas de `healthcheck`
  ni `read_only`/`cap_drop` dans le compose. *(Infra, S)*
- **[L7] Comptes/devices de démo recréés en prod** : `docs/DEPLOY.md:94-102` recrée `868000000000101/102/103`
  ; `seed_dev.sql` insère un owner+device seed. À purger de la prod réelle. *(DB, S)*
- **[L8] Garde d'action contournée si device absent de la flotte** : `commands.service.ts:50`
  n'appelle `assertAction` que `if (dev)` ; un `deviceId` inconnu saute le contrôle (retourne `offline`,
  aucune commande envoyée → non exploitable, mais robustesse à corriger). *(Backend, S)*

### ⚪ INFO

- **[I1] Bypass API assumés** : le mobile parle direct à Supabase uniquement pour l'**auth** (login
  username/signup) et la lecture/écriture de **sa propre ligne `clients`** (RemindersGate, ProfileScreen).
  Tout le reste (véhicules, commandes, géofences, rapports, partages, alarmes, prefs) passe par la
  façade. Le login IMEI est bien routé via l'API (rate-limit). Cartographie conforme à la doc, à ceci
  près que la RLS reste la seule barrière sur les écritures `clients` directes (couverte par les policies
  `clients_self_*`).
- **[I2] Aucun monitoring/alerting** : `logError`/`Logger` = console uniquement ; pas de Sentry, pas de
  healthcheck applicatif exploité, pas de détection de silence device côté infra. Le hook Sentry est
  prévu mais non branché.
- **[I3] Pas de sauvegardes documentées** (Supabase plan Pro = PITR possible à confirmer ; Traccar sur
  volume H2 embarqué, non sauvegardé). À formaliser.
- **[I4] N+1 dans `subaccounts.list`** : une requête `device_access` par sous-compte
  (`subaccounts.service.ts:71-75`). Volumétrie faible aujourd'hui ; à surveiller.

---

## 3. Checklist des bugs historiques

| Bug historique | Statut | Preuve |
|---|---|---|
| `mergePositions` écrasait `accessRole`/`accessStatus` | ✅ Toujours corrigé | `useVehicles.ts:41-42` préserve `ex.accessRole ?? inc.accessRole`. Aucun autre champ métier écrasé (name/phone/owner en `ex ?? inc`, reste `ex.`). |
| `ensureDeviceAccount` câblé seulement sur `enroll` | ✅ Corrigé | `vehicles.controller.ts:71` (addAccess) **et** `:89` (enroll) appellent `provisionWalkUp`. |
| `upsertByImei` hardcodait un `owner_id` de fixture | ✅ Corrigé | `devices.service.ts:61-75` : l'UPDATE ne touche jamais `owner_id` ; `SEED_OWNER_ID`/`000000aa` **absents** du code `api/src` (grep vide). |
| Catch silencieux avalant les erreurs | ✅ Majoritairement corrigé | Aucun `catch {}` vide (grep vide). Restent 2 catch best-effort **justifiés et commentés** (`geofences.remove` suppression Traccar déjà absente ; `registerPushToken`). |
| Dérive de déploiement VPS (backend en retard) | ⚠️ Non vérifiable | Nécessite `git rev-parse HEAD` sur le VPS (annexe A4). Aggravé : audit sur une branche non fusionnée. |
| Fuite de messages Java bruts en UI | ❌ **Régression** | Cf. **M1** : `ProfileScreen`, `AuthScreen`, `TrajectoryScreen`, `AlarmsScreen`, `ShareSheet` affichent `.message` brut au lieu de `toUserMessage`. |
| Comptes walk-up de démo à purger | ⚠️ Non vérifiable / à risque | `docs/DEPLOY.md:94-102` **recrée** `868…101/102/103`. Requête de contrôle en annexe A2. |
| Code mort (TabBar, transferByImei, DevThemeSwitcher, 7 variantes, variantFonts) | ✅ / ⚠️ Mixte | DevThemeSwitcher + `variants/` + `variantFonts` correctement derrière `__DEV__` + `require()` (élimination Metro en prod : `App.tsx:11`, `fonts.ts:114`, `ThemeProvider.tsx:11`). `transferByImei` retiré du TS. **Reste** `TabBar.tsx` (L1) et la RPC `device_transfer` (L2). |
| Rate-limit login IMEI (jadis direct Supabase) | ✅ Corrigé | Login IMEI routé via `POST /auth/imei-login` → `device_attempts_blocked`/`loginBump` (0008). Le login **username** reste direct GoTrue (M5). |

---

## 4. Feuille de route de remédiation priorisée

**Bloc 0 — à traiter avant TOUTE exposition élargie (dépendances fortes)**
1. **C3** (secret device/compte `123456`) — racine de l'exploitation. Forcer rotation / secret aléatoire.
2. **C2** (enroll adopte l'IMEI sans mot de passe) — fermer le chemin ou le réserver à l'admin.
3. **C1 + H4** (TLS + CORS restreint) — dépend de rien, débloque tout le reste ; à faire **avant** le web.
4. **H2** (changement mot de passe device par non-propriétaire) — trancher le modèle, cohérent avec C3.

**Bloc 1 — autorisation serveur**
5. **H1** (rôle consultation en écriture) — `assertAction` sur toutes les écritures. *Dépend du modèle de rôle validé.*
6. **H3** (RLS alignée sur `device_access` + masquage `device_password`) — **prérequis dur avant la version web**.

**Bloc 2 — durcissement**
7. **M3** (jetons de partage) · **M5** (rate-limit global) · **M2** (oracle enroll) · **M6** (DTO validation).
8. **M4** (fermer Traccar 8082) · **M7** (garde de version au déploiement).

**Bloc 3 — hygiène / UX / dette**
9. **M1** (fuite d'erreurs UI) · **L1–L8** · **I2–I4** (monitoring, sauvegardes).

> Dépendances explicites : **corriger H3 + C1 + H4 avant de déployer le web** ; **C3 avant H2** (même
> modèle de secret) ; **C2/M2 ensemble** (même endpoint `enroll`).

---

## 5. Annexe — À vérifier manuellement (commandes read-only)

> Aucune commande n'écrit. À exécuter par l'équipe après validation.

**A1 — Migrations réellement appliquées en prod (Supabase, read-only)**
```sql
-- Supabase SQL editor / psql en lecture seule
select version, name from supabase_migrations.schema_migrations order by version;
-- Vérifier la présence de 0007 et 0008, et que device_set_password est la version "accès actif" :
select prosrc from pg_proc where proname = 'device_set_password';
select proname, prosecdef, proconfig from pg_proc
 where proname in ('device_add_access','device_set_password','device_grant_subaccount',
                   'device_attempts_blocked','has_device_access');
```

**A2 — Comptes/devices de démo et intégrité (read-only)**
```sql
-- Devices de démo à purger
select id, imei, name, owner_id from public.devices
 where imei in ('868000000000101','868000000000102','868000000000103','1234567890','356789123456781');
-- Comptes walk-up par défaut encore en 123456 (impossible via hash ; repérer les comptes IMEI)
select id, email from auth.users where email ~ '^\d{10,17}@kelentane\.com$';
-- Doublons device_access (devrait être impossible via la contrainte unique)
select device_id, user_id, count(*) from public.device_access group by 1,2 having count(*) > 1;
-- Lignes orphelines / comptes sans accès
select c.id from public.clients c
 left join public.device_access da on da.user_id = c.id where da.user_id is null;
-- Devices dont device_password est resté au défaut ? (ne peut être prouvé que par test de crypt)
select id, imei from public.devices where device_password is null;
```

**A3 — Exposition Traccar 8082 / admin par défaut (VPS)**
```bash
# SSH VPS (Linux) — lecture seule
sudo ufw status | grep -E '8082|5023|3000'
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i traccar
# Tester que l'admin par défaut NE marche PAS (ne pas laisser de session ouverte) :
curl -s -o /dev/null -w '%{http_code}\n' -u 'admin:admin' http://127.0.0.1:8082/api/session
```

**A4 — Dérive de déploiement HEAD VPS vs origin/main (VPS)**
```bash
# SSH VPS (Linux) — lecture seule, dans le dossier du repo déployé
cd /root/kelentane 2>/dev/null || cd ~/kelentane
git fetch origin --quiet
echo "VPS  HEAD: $(git rev-parse HEAD)"
echo "origin/main: $(git rev-parse origin/main)"
git log --oneline origin/main...HEAD | head
```

**A5 — Secrets réellement chargés côté conteneur (VPS, ne PAS afficher les valeurs)**
```bash
# SSH VPS — vérifie la PRÉSENCE sans révéler la valeur
docker exec kelentane-api sh -c 'for v in SUPABASE_SERVICE_ROLE_KEY TRACCAR_PASS SUPABASE_PUBLISHABLE_KEY; do \
  eval val=\$$v; [ -n "$val" ] && echo "$v: set (${#val} chars)" || echo "$v: MISSING"; done'
# Confirmer que .env.production n'est pas suivi par git :
cd /root/kelentane && git check-ignore -v api/.env.production
```

**A6 — Vérification TLS/transport (poste local, PowerShell)**
```powershell
# Windows PowerShell — confirme l'absence de HTTPS sur l'API prod
Invoke-WebRequest -Uri 'http://31.97.176.235:3000/health' -UseBasicParsing | Select-Object StatusCode
try { Invoke-WebRequest -Uri 'https://31.97.176.235:3000/health' -UseBasicParsing -TimeoutSec 5 } catch { $_.Exception.Message }
```

---

*Fin du rapport. 26 findings (3 critiques, 4 élevés, 7 moyens, 8 faibles, 4 info). Aucun correctif
appliqué — investigation et diagnostic uniquement, conformément aux règles de mission.*
