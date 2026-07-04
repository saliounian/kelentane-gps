# Déploiement — API façade sur le VPS (Docker)

Cible : VPS `31.97.176.235` (Traccar + API façade dans le même docker-compose,
réseau interne). Le mobile ne parle qu'à l'**API :3000** ; Traccar reste interne.

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

## 2. Traccar : réutiliser l'existant OU repartir propre

Ton Traccar tourne déjà (admin + 3 devices démo créés). **Deux options :**

**Option A — garder ton Traccar existant (le plus simple, pas de perte de données)**
Ne pas démarrer le service `traccar` du compose. L'API le joint par l'IP du VPS.
```bash
# éditer infra/docker-compose.yml : commenter le bloc "traccar:" et "depends_on"
# puis dans api/.env.production mettre :  TRACCAR_URL=http://31.97.176.235:8082
# (et retirer l'override TRACCAR_URL du service api dans le compose)
```

**Option B — stack complète neuve (Traccar géré par le compose)**
```bash
# libère les ports : stoppe l'ancien conteneur Traccar
docker ps ; docker stop <ancien_traccar> && docker rm <ancien_traccar>
```
> Volume neuf → il faudra recréer l'admin (§4) et les 3 devices démo (§6).

## 3. Variables d'environnement de l'API
```bash
cp api/.env.production.example api/.env.production
nano api/.env.production
```
Renseigner :
- `TRACCAR_USER` / `TRACCAR_PASS` = compte admin Traccar (celui du VPS).
- `SUPABASE_SERVICE_ROLE_KEY` = clé service_role (Dashboard Supabase → Project Settings → API).
- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` : déjà pré-remplis.
- Ne PAS toucher `TRACCAR_URL` (le compose le force à `http://traccar:8082` en option B).

`api/.env.production` est **gitignoré** — ne jamais le committer.

## 4. (Option B seulement) démarrer Traccar puis créer l'admin
```bash
docker compose -f infra/docker-compose.yml up -d traccar
# ouvrir http://31.97.176.235:8082 → créer le compte admin
# reporter email+mot de passe dans api/.env.production
```

## 5. Build + démarrage de l'API
```bash
docker compose -f infra/docker-compose.yml up -d --build api
docker compose -f infra/docker-compose.yml logs -f api   # vérifier le boot + "WebSocket Traccar connecté"
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
