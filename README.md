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
