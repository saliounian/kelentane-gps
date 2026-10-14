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
-- bcrypt via crypt(), pas de stockage du mot de passe en clair). Ainsi le flag est
-- posé correctement quel que soit l'appelant (accounts.service.ts, ou tout futur
-- appelant), sans dépendre d'un paramètre "is this a fresh account" côté API —
-- important car ensureDeviceAccount est IDEMPOTENT (rappelée à chaque enroll/
-- addAccess) : le poser depuis l'API aurait remis le flag à true après que
-- l'utilisateur l'ait déjà changé.
--
-- Remise à false : le changement de mot de passe compte se fait AUJOURD'HUI côté
-- mobile en DIRECT contre Supabase Auth (ProfileScreen.tsx → supabase.auth.updateUser),
-- PAS via une route API — il n'existe donc PAS de "route de changement de mot de
-- passe existante" côté API à modifier (seules les routes API existantes changent
-- le mot de passe du DISPOSITIF, cf. ci-dessus). On accroche donc la remise à false
-- à auth.users (trigger sur UPDATE OF encrypted_password), ce qui couvre ce flux
-- mobile sans le modifier, et continuera de fonctionner si une route API de
-- changement de mot de passe COMPTE est ajoutée plus tard (elle passera forcément
-- par une mise à jour de auth.users).

alter table public.clients
  add column if not exists must_change_password boolean not null default false;

comment on column public.clients.must_change_password is
  'Nudge "changer le mot de passe" (§2 walk-up IMEI, mdp par défaut 123456). '
  'Posé à la création si le mdp COMPTE créé vaut encore le défaut (handle_new_user), '
  'remis à false dès que auth.users.encrypted_password change (handle_password_change). '
  'Distinct du mot de passe DISPOSITIF (devices.device_password).';

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
    coalesce(extensions.crypt('123456', new.encrypted_password) = new.encrypted_password, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─── Remise à false dès que le mot de passe COMPTE change (quel que soit le flux) ─
create or replace function public.handle_password_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.clients set must_change_password = false where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_password_changed on auth.users;
create trigger on_auth_user_password_changed
  after update on auth.users
  for each row execute function public.handle_password_change();

-- ─── Backfill — UNIQUEMENT déterminable ─────────────────────────────────────────
-- Comptes auto-provisionnés = walk-up IMEI (identifiant = IMEI d'un device
-- existant, accès 'action' sur CE device — signature exacte d'ensureDeviceAccount).
-- "Jamais changé" = déterminé par crypt() : le hash bcrypt stocké (avec SON sel)
-- correspond-il encore au mot de passe par défaut "123456" ? Si oui → jamais changé
-- (bascule à true). Si non → changé à un moment (reste false). Aucune supposition :
-- c'est une vérification cryptographique directe sur le hash actuel.
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
  and extensions.crypt('123456', u.encrypted_password) = u.encrypted_password;
