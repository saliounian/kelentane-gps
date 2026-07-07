# Déploiement — API façade sur le VPS (Docker)

Cible : VPS `31.97.176.235`. **Traccar et l'API façade sont deux stacks Docker
séparées** qui partagent le réseau `traccar_default`. Le mobile ne parle qu'à
l'**API :3000** ; Traccar reste interne (jamais exposé au mobile).

> ⚠️ Ces commandes sont à exécuter **par toi sur le VPS** (Claude n'a pas d'accès SSH).

## 0. Pré-requis VPS
```bash
docker --version && docker compose version   # Docker + plugin compose installés
```

## 1. Récupérer le code sur le VPS
```bash
git clone <URL_DU_REPO> kelentane && cd kelentane
# (ou : scp -r api infra docs vers le VPS)
```

## 2. Traccar : stack externe séparée (NE PAS la gérer via ce compose)

Traccar tourne dans sa **propre** stack Docker, indépendante de
`infra/docker-compose.yml` :
- **VPS (prod)** : `/root/traccar/docker-compose.yml` → conteneur `traccar-traccar-1`,
  réseau `traccar_default`, **données réelles** (véhicules, positions, comptes, ports
  8082/5023 pour les boîtiers GT06).
- **Local (dev/test)** : `infra/traccar/docker-compose.yml` (même réseau `traccar_default`).

`infra/docker-compose.yml` **ne définit plus de service `traccar`**. Il rejoint le
réseau **externe** `traccar_default` où le vrai Traccar publie l'alias réseau
`traccar` → l'API le joint par `http://traccar:8082`, sans commande manuelle.

> ⚠️ **Historique bug (2026-07) :** ce compose définissait un service `traccar`
> qui recréait un **2ᵉ conteneur Traccar vide** (`kelentane-traccar`) en doublon du
> vrai, sur un réseau différent → l'API tombait en `getaddrinfo EAI_AGAIN traccar`.
> Corrigé : service `traccar` retiré, réseau `traccar_default` déclaré `external: true`,
> l'API attachée à ce réseau. **Ne jamais réintroduire un service `traccar` ici** —
> ça recréerait le doublon et repartirait sur un volume vide.

**Ordre de démarrage** — le réseau externe doit exister AVANT de lancer l'API :
```bash
# La stack Traccar tourne déjà en prod. Sinon la démarrer AVANT :
#   (VPS)   cd /root/traccar && docker compose up -d
#   (local) docker compose -f infra/traccar/docker-compose.yml up -d
docker network ls | grep traccar_default   # doit exister avant l'étape 5
```

## 3. Variables d'environnement de l'API
```bash
cp api/.env.production.example api/.env.production
nano api/.env.production
```
Renseigner :
- `TRACCAR_USER` / `TRACCAR_PASS` = compte admin Traccar (celui du VPS).
- `SUPABASE_SERVICE_ROLE_KEY` = clé service_role (Dashboard Supabase → Project Settings → API).
- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` : déjà pré-remplis.
- Ne PAS toucher `TRACCAR_URL` : le compose le force à `http://traccar:8082` (alias
  réseau du Traccar externe sur `traccar_default`).

`api/.env.production` est **gitignoré** — ne jamais le committer.

## 4. Compte admin Traccar
Utiliser le compte admin du **Traccar de prod existant** (`/root/traccar`). Reporter
`TRACCAR_USER` / `TRACCAR_PASS` dans `api/.env.production` (§3). **Ne pas** démarrer
de Traccar via `infra/docker-compose.yml` : il n'en gère plus (voir §2).

## 5. Build + démarrage de l'API
```bash
docker compose -f infra/docker-compose.yml up -d --build api
docker compose -f infra/docker-compose.yml logs -f api   # vérifier le boot + "WebSocket Traccar connecté"
```
**Vérifs post-déploiement :**
```bash
# a) AUCUN doublon Traccar recréé (ne doit rien renvoyer) :
docker ps -a --format '{{.Names}}' | grep -x kelentane-traccar && echo "⚠️ DOUBLON présent" || echo "OK: pas de doublon"
# b) l'API est bien sur le réseau du vrai Traccar :
docker inspect kelentane-api --format '{{json .NetworkSettings.Networks}}'   # doit lister traccar_default
# c) plus d'erreur EAI_AGAIN dans les logs :
docker compose -f infra/docker-compose.yml logs --tail=30 api | grep -i "EAI_AGAIN\|Traccar"
```

## 6. Pare-feu (indispensable pour le mobile)
```bash
sudo ufw allow 3000/tcp   # API façade (mobile)
sudo ufw allow 5023/tcp   # GT06 (boîtiers)
sudo ufw allow 8082/tcp   # UI Traccar (optionnel ; à restreindre en prod)
```

## 7. Vérifier
```bash
curl http://31.97.176.235:3000/health          # {"status":"ok",...}
```

## 8. (si Traccar neuf) recréer les 3 devices démo
```bash
U="<admin_email>"; P="<admin_pass>"
for uid in 868000000000101 868000000000102 868000000000103; do
  curl -s -u "$U:$P" -H "Content-Type: application/json" \
    -X POST http://31.97.176.235:8082/api/devices \
    -d "{\"name\":\"Demo $uid\",\"uniqueId\":\"$uid\"}"
done
```
(Le tenant démo Supabase est déjà en base — pas besoin de re-seed sauf reset.)

## 9. Mobile → rebuild EAS

`API_URL` lit `EXPO_PUBLIC_API_URL` (défaut = `http://31.97.176.235:3000`).
Rien à changer si tu gardes cette IP. Sinon :
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value http://31.97.176.235:3000 --type string
```
Puis **rebuild le dev client** (le cleartext HTTP Android est déjà activé via
`expo-build-properties`) :
```bash
eas build --profile development --platform android
```

## Notes / prod
- **HTTP en clair sur IP** : autorisé côté app (`usesCleartextTraffic` Android +
  ATS iOS). Acceptable pour dev/démo. **Avant prod réelle** : mettre un domaine +
  **HTTPS** (reverse proxy Caddy/Nginx + Let's Encrypt) et pointer `EXPO_PUBLIC_API_URL`
  dessus, puis retirer les exceptions cleartext.
- CORS de l'API est ouvert (`app.enableCors()`), ok pour le mobile.
- Isolation multi-tenant + WebSocket relayé inchangés (déjà validés).
