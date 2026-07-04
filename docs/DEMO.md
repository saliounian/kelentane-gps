# Tenant démo — supervision Kelentane GPS

Tenant **isolé** (aucune donnée client réelle) pour montrer une flotte « vivante »
en parallèle du dev. Mêmes règles RLS/multi-tenant que n'importe quel client :
le compte démo ne voit QUE ses véhicules démo.

## Identifiants
- **Identifiant** : `demo`  (email interne `demo@kelentane.com`)
- **Mot de passe** : `KelentaneDemo1`

## Véhicules démo (3, fictifs)
| IMEI | Nom | Plaque | Type |
|---|---|---|---|
| 868000000000101 | Démo · Peugeot Expert | DK-0001-DEMO | van |
| 868000000000102 | Démo · Master tine | DK-0002-DEMO | truck |
| 868000000000103 | Démo · Taxi Ndiaye | DK-0003-DEMO | taxi |

## (Re)créer / réinitialiser les données démo
```bash
node infra/supabase/seed_demo.js          # crée / met à jour (idempotent)
node infra/supabase/seed_demo.js --reset  # supprime puis recrée à neuf
```
Le script lit le `service_role` depuis `api/.env` (jamais affiché). Il crée le
compte auth + la ligne `clients` + les 3 `devices` (owner = compte démo).

## Rendre la démo « vivante » (positions temps réel)
Les positions viennent de Traccar via le WebSocket relayé. Pour que les 3 véhicules
bougent :
1. Lancer Traccar : `docker compose -f infra/traccar/docker-compose.yml up -d`
2. Dans l'UI Traccar (http://localhost:8082), créer **3 devices** avec les IMEIs
   ci-dessus comme `identifiant` (uniqueId).
3. Lancer un simulateur GT06 par véhicule (3 terminaux) :
   ```bash
   node infra/gt06-sim/gt06-sim.js 868000000000101
   node infra/gt06-sim/gt06-sim.js 868000000000102
   node infra/gt06-sim/gt06-sim.js 868000000000103
   ```
4. Démarrer l'API façade (`cd api && npm run start:dev`) — elle relaie le WS Traccar.
5. Se connecter dans l'app avec `demo` / `KelentaneDemo1` → carte vivante temps réel.

- **Historique / stats / trajet** : se remplissent tout seuls au fil du mouvement
  des simulateurs (reports Traccar).
- **Alarmes de test** : créer une géofence sur un véhicule démo depuis l'app
  (écran Géofence) → les événements enter/exit apparaissent dans Alarmes.

## Isolation (vérifiée)
Périmètre démo = uniquement les 3 IMEIs `86800000000010x`. Aucun recouvrement avec
les autres tenants (ex. seed dev `356789123456781`). Filtrage à la source côté API
(REST + WebSocket), jamais côté client.
