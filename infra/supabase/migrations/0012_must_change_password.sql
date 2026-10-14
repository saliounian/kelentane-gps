-- 0012 — Nudge de changement de mot de passe pour les comptes créés avec un
-- mot de passe par défaut connu (walk-up IMEI, §2 : "123456").
--
-- IMPORTANT — deux mots de passe DISTINCTS dans ce projet, à ne pas confondre :
--   • mot de passe du DISPOSITIF (communication GT06/Traccar) — devices.device_password,
--     DEFAULT_DEVICE_PASSWORD dans admin.service.ts, reset via device_admin_reset_password.
--     Rien à voir avec ce flag.
--   • mot de passe du COMPTE (Supabase Auth, auth.users) — DEFAULT_DEVICE_PASSWORD dans
--     accounts.service.ts, utilisé par POST /auth/imei-login. C'EST celui-ci que
--     must_change_password concerne.
--
-- Le compte walk-up est créé via createAuthUser (service_role), ce qui déclenche
-- TOUJOURS le trigger on_auth_user_created (0006) → handle_new_user(). On y calcule
-- le flag directement depuis le mot de passe fourni à la création (comparaison
-- bcrypt via is_default_password(), pas de stockage du mot de passe en clair).
-- Ainsi le flag est posé correctement quel que soit l'appelant, sans dépendre d'un
-- paramètre "is this a fresh account" côté API — important car ensureDeviceAccount
-- est IDEMPOTENT (rappelée à chaque enroll/addAccess) : le poser depuis l'API aurait
-- remis le flag à true après que l'utilisateur l'ait déjà changé.
--
-- Recalcul : le changement de mot de passe compte se fait AUJOURD'HUI côté mobile
-- en DIRECT contre Supabase Auth (ProfileScreen.tsx → supabase.auth.updateUser),
-- PAS via une route API — il n'existe donc PAS de "route de changement de mot de
-- passe existante" côté API à modifier (seules les routes API existantes changent
-- le mot de passe du DISPOSITIF, cf. ci-dessus). On accroche donc le recalcul à
-- auth.users (trigger sur UPDATE OF encrypted_password), ce qui couvre ce flux
-- mobile sans le modifier. Le flag est RECALCULÉ (pas juste remis à false) : si le
-- nouveau mot de passe choisi est, par coïncidence, encore "123456", le flag reste
-- à true — cohérent avec ce qu'il mesure réellement (mdp actuel = défaut ou pas).

-- is_default_password(hash) isole la comparaison bcrypt dans une fonction dédiée,
-- défensive : ne lève JAMAIS d'exception (bloc EXCEPTION WHEN OTHERS -> false),
-- renvoie false si le hash est NULL ou n'a pas la forme d'un hash bcrypt valide
-- (préfixe '$2a$'/'$2b$'/'$2x$'/'$2y$') — robuste à un hash vide/legacy/corrompu.
-- EXECUTE révoqué pour public/anon/authenticated : appelable uniquement par les
-- fonctions SECURITY DEFINER de cette migration.
create or replace function public.is_default_password(hash text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if hash is null or hash !~ '^\$2[abxy]\$' then
    return false;
  end if;
  return extensions.crypt('123456', hash) = hash;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_default_password(text) from public, anon, authenticated;

alter table public.clients
  add column if not exists must_change_password boolean not null default false;

comment on column public.clients.must_change_password is
  'Nudge "changer le mot de passe" (§2 walk-up IMEI, mdp par défaut 123456). '
  'Posé à la création et recalculé à chaque changement de auth.users.encrypted_password '
  '(is_default_password). Distinct du mot de passe DISPOSITIF (devices.device_password).';

-- ─── Pose à la création (redéfinit le trigger 0006, AJOUTE le calcul du flag) ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.clients (id, name, must_change_password)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    public.is_default_password(new.encrypted_password)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─── Recalcul à chaque changement du mot de passe COMPTE ───────────────────────
-- Défensif : une erreur ici ne doit jamais faire échouer la mise à jour auth.users
-- elle-même (ex. changement de mot de passe cassé pour l'utilisateur) → RAISE WARNING
-- (visible dans les logs Postgres) + return new (laisse passer l'update).
create or replace function public.handle_password_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients
    set must_change_password = public.is_default_password(new.encrypted_password)
    where id = new.id;
  return new;
exception
  when others then
    raise warning 'handle_password_change (%): %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_password_changed on auth.users;
create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.handle_password_change();

-- ─── Backfill — UNIQUEMENT déterminable ─────────────────────────────────────────
-- Comptes auto-provisionnés = walk-up IMEI (identifiant = IMEI d'un device
-- existant, accès 'action' sur CE device — signature exacte d'ensureDeviceAccount).
-- "Mot de passe par défaut actif" = is_default_password() sur le hash actuel.
-- Aucune supposition : vérification cryptographique directe sur le hash actuel.
update public.clients c
set must_change_password = true
from auth.users u
where u.id = c.id
  and c.must_change_password = false
  and exists (
    select 1
    from public.devices d
    join public.device_access da on da.device_id = d.id and da.user_id = c.id and da.role = 'action'
    where d.imei = split_part(u.email, '@', 1)
  )
  and public.is_default_password(u.encrypted_password);
