-- 0007 — Modèle d'accès multi-comptes (device_access).
--
-- Plusieurs comptes peuvent accéder au MÊME device, avec des droits identiques par
-- défaut, SANS propriétaire exclusif. Remplace la sémantique owner_id unique
-- (colonne conservée en legacy, migrée ci-dessous — aucune perte de données).
--
-- Sécurité : vérification du mot de passe device + rate-limit + insertion d'accès
-- se font EN BASE (SECURITY DEFINER, service_role) → le hash ne sort jamais de
-- Postgres, et l'erreur est générique (anti-énumération d'IMEI).

-- 1) Sous-comptes (§4) : lien vers le compte principal (NULL = compte principal).
alter table public.clients
  add column if not exists parent_account_id uuid references public.clients(id) on delete set null;

-- 2) Table de liaison accès (N-N compte↔device).
create table if not exists public.device_access (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null references public.devices(id) on delete cascade,
  user_id     uuid not null references public.clients(id) on delete cascade,
  role        text not null default 'action'  check (role   in ('consultation', 'action')),
  status      text not null default 'active'  check (status in ('active', 'revalidate')),
  granted_by  uuid references public.clients(id) on delete set null, -- compte principal (sous-comptes)
  created_at  timestamptz not null default now(),
  unique (device_id, user_id)
);
alter table public.device_access enable row level security;
create policy device_access_self_select on public.device_access
  for select using (user_id = auth.uid());

create index if not exists device_access_user_idx   on public.device_access (user_id);
create index if not exists device_access_device_idx on public.device_access (device_id);

-- 3) Backfill NON destructif : owner_id existant → premier accès (rôle 'action').
insert into public.device_access (device_id, user_id, role, status)
select d.id, d.owner_id, 'action', 'active'
from public.devices d
where d.owner_id is not null
on conflict (device_id, user_id) do nothing;

-- 4) Rate-limit d'ajout / login par IMEI (anti brute-force du mdp par défaut 123456).
create table if not exists public.device_auth_attempts (
  imei         text primary key,
  attempts     int not null default 0,
  window_start timestamptz not null default now()
);

-- 5) RPC : rate-limit + vérif mot de passe device + ajout d'un accès COEXISTANT.
--    Retourne un code machine ; 'bad' est identique pour IMEI inconnu OU mauvais mdp.
create or replace function public.device_add_access(p_imei text, p_password text, p_user uuid)
returns text  -- 'ok' | 'bad' | 'rate_limited'
language plpgsql security definer set search_path = public, extensions
as $$
declare
  d public.devices;
  a public.device_auth_attempts;
  win interval := interval '15 minutes';
begin
  select * into a from public.device_auth_attempts where imei = p_imei for update;
  if found and a.window_start > now() - win and a.attempts >= 5 then
    return 'rate_limited';
  end if;
  if not found or a.window_start <= now() - win then
    insert into public.device_auth_attempts (imei, attempts, window_start)
    values (p_imei, 0, now())
    on conflict (imei) do update set attempts = 0, window_start = now();
  end if;

  select * into d from public.devices where imei = p_imei;
  if not found or d.device_password is null
     or d.device_password <> crypt(p_password, d.device_password) then
    update public.device_auth_attempts set attempts = attempts + 1 where imei = p_imei;
    return 'bad';
  end if;

  update public.device_auth_attempts set attempts = 0, window_start = now() where imei = p_imei;
  -- accès coexistant ; ré-ajout après révocation douce → repasse 'active'.
  insert into public.device_access (device_id, user_id, role, status)
  values (d.id, p_user, 'action', 'active')
  on conflict (device_id, user_id) do update set status = 'active';
  return 'ok';
end;
$$;

-- 6) Changement de mot de passe device : révocation DOUCE des autres accès (§5).
--    L'appelant garde son accès actif ; les autres passent 'revalidate'.
create or replace function public.device_set_password(p_traccar_id integer, p_owner uuid, p_new text)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare d public.devices;
begin
  select * into d from public.devices where traccar_id = p_traccar_id;
  if not found then return false; end if;
  if not exists (
    select 1 from public.device_access
    where device_id = d.id and user_id = p_owner and status = 'active'
  ) then
    return false; -- seul un compte à accès actif peut changer le mot de passe
  end if;
  update public.devices set device_password = crypt(p_new, gen_salt('bf')), updated_at = now()
    where id = d.id;
  update public.device_access set status = 'revalidate'
    where device_id = d.id and user_id <> p_owner;
  return true;
end;
$$;

-- 7) Sous-comptes (§4) : accorde/ajuste un accès à un device pour un sous-compte.
--    Réservé au compte principal (granted_by), rôle consultation|action.
create or replace function public.device_grant_subaccount(
  p_device_id uuid, p_sub_user uuid, p_role text, p_parent uuid
) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if p_role not in ('consultation', 'action') then return false; end if;
  -- le parent doit lui-même avoir un accès actif au device
  if not exists (
    select 1 from public.device_access
    where device_id = p_device_id and user_id = p_parent and status = 'active'
  ) then
    return false;
  end if;
  -- le sous-compte doit appartenir au parent
  if not exists (
    select 1 from public.clients where id = p_sub_user and parent_account_id = p_parent
  ) then
    return false;
  end if;
  insert into public.device_access (device_id, user_id, role, status, granted_by)
  values (p_device_id, p_sub_user, p_role, 'active', p_parent)
  on conflict (device_id, user_id) do update set role = excluded.role, status = 'active', granted_by = p_parent;
  return true;
end;
$$;

revoke all on function public.device_add_access(text, text, uuid)           from public, anon, authenticated;
revoke all on function public.device_set_password(integer, uuid, text)       from public, anon, authenticated;
revoke all on function public.device_grant_subaccount(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.device_add_access(text, text, uuid)           to service_role;
grant execute on function public.device_set_password(integer, uuid, text)       to service_role;
grant execute on function public.device_grant_subaccount(uuid, uuid, text, uuid) to service_role;
