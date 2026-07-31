-- 0009 — (a) Corrige H2 : device_set_password exigeait juste un accès 'active',
-- sans vérifier le rôle. Un accès 'consultation' pouvait changer le mot de
-- passe du device au même titre qu'un accès 'action'.
-- (b) Ajoute un reset admin : un compte is_admin=true peut réinitialiser le
-- mot de passe de N'IMPORTE QUEL device, sans device_access ni ancien mdp.
-- Réservé à la future UI web (aucun accès mobile, aucun endpoint public).

alter table public.clients
  add column if not exists is_admin boolean not null default false;

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
    where device_id = d.id and user_id = p_owner and status = 'active' and role = 'action'
  ) then
    return false;
  end if;
  update public.devices set device_password = crypt(p_new, gen_salt('bf')), updated_at = now()
    where id = d.id;
  update public.device_access set status = 'revalidate'
    where device_id = d.id and user_id <> p_owner;
  return true;
end;
$$;

create or replace function public.device_admin_reset_password(p_traccar_id integer, p_admin uuid, p_new text)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare
  d public.devices;
  is_admin_ok boolean;
  admin_parent uuid;
  parent_is_admin boolean;
begin
  select is_admin, parent_account_id into is_admin_ok, admin_parent
    from public.clients where id = p_admin;
  if is_admin_ok is not true then
    return false;
  end if;

  select * into d from public.devices where traccar_id = p_traccar_id;
  if not found then return false; end if;

  update public.devices set device_password = crypt(p_new, gen_salt('bf')), updated_at = now()
    where id = d.id;

  if admin_parent is not null then
    select is_admin into parent_is_admin from public.clients where id = admin_parent;
  end if;

  update public.device_access set status = 'revalidate'
    where device_id = d.id
      and user_id <> p_admin
      and (parent_is_admin is not true or user_id <> admin_parent);

  return true;
end;
$$;

revoke all on function public.device_set_password(integer, uuid, text) from public, anon, authenticated;
revoke all on function public.device_admin_reset_password(integer, uuid, text) from public, anon, authenticated;
grant execute on function public.device_set_password(integer, uuid, text) to service_role;
grant execute on function public.device_admin_reset_password(integer, uuid, text) to service_role;
