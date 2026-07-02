# Kelentane GPS

Suivi GPS / télématique flotte (marché sénégalais, FR par défaut). Boîtiers GT06N.

## Architecture

```
Boîtiers GT06N ──gt06──▶ Traccar (cœur GPS)  ◀──REST/WS── API façade (Nest)
                          (jamais exposé          │            ▲
                           au mobile)             │            │ HTTPS
                                                  ▼            │
                                            base app        Mobile (Expo/RN)
                                          Supabase (RLS) ◀──Auth+RLS──┘
```

- **Mobile** ne parle qu'à l'**API façade** (positions, commandes) et à **Supabase Auth** (login + lectures RLS). Aucun secret ni accès Traccar côté client.
- **Traccar** ingère le protocole GT06, tient devices/positions/géofences/commandes/reports.
- **Supabase** : multi-tenant (clients, devices miroir + champs métier, partages, géofences, prefs notif, facturation SIM), RLS.

## Layout du dépôt (monorepo)

```
/            app mobile Expo (React Native) — racine
/src         code app (theme, ui, config, screens…)
/api         API façade NestJS (client Traccar + Supabase service role)
/infra       docker-compose Traccar (test) et infra
```

> Note : le mobile est à la racine ; `api/` et `infra/` sont des projets frères,
> chacun avec ses propres dépendances. Déplaçable vers `apps/mobile` plus tard.

## Démarrage

### Traccar (test)
```bash
docker compose -f infra/traccar/docker-compose.yml up -d
# UI : http://localhost:8082 (créer l'admin), port GT06 : 5023
```

### Positions réelles en dev (simulateur GT06)
1. Dans l'UI Traccar, créer un device avec `identifiant` (uniqueId) = IMEI du simulateur
   (`356789123456781` par défaut). Traccar ignore les boîtiers inconnus.
2. Lancer le feeder (pousse des positions Dakar toutes les 5 s) :
   ```bash
   node infra/gt06-sim/gt06-sim.js
   ```
3. `GET /vehicles` de l'API renvoie alors le véhicule avec sa position réelle ;
   la carte + la liste du mobile l'affichent.

> Émulateur Android : `localhost` pointe l'émulateur, pas la machine hôte.
> Régler `API_URL` sur `http://10.0.2.2:3000` (ou l'IP LAN sur appareil réel)
> dans `src/config/env.ts`.

### API façade
```bash
cd api && cp .env.example .env   # renseigner TRACCAR_* et SUPABASE_*
npm install && npm run start:dev # http://localhost:3000  (GET /health, GET /vehicles)
```

### Mobile
```bash
npm install && npm start         # Expo
```

## Design system

Source de vérité : maquette + `docs/handoff`. Tokens dans `src/theme`.
**Règle absolue** : le lime `#D4FF17` est réservé marque / action / sélection —
jamais un statut véhicule (statut = TEAL/PARKED/OFFLINE/ALERT).
