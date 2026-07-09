-- 0005 — Transfert de dispositif protégé par un mot de passe propre au device.
--
-- Contexte : un IMEI ne peut appartenir qu'à un seul owner_id. Pour permettre de
-- transférer un boîtier déjà enregistré vers un autre compte (revente, changement
-- de propriétaire), on ajoute un mot de passe HASHÉ (bcrypt via pgcrypto) porté par
-- le device lui-même — distinct du mot de passe du compte utilisateur.
--
-- Défaut "123456" pour tout device existant ET futur ; le propriétaire peut le
-- changer depuis l'app (écran détail) pour sécuriser son boîtier.
--
-- Hashage/vérif entièrement en base (SECURITY DEFINER) : le hash ne sort jamais de
-- Postgres, l'API façade appelle seulement les RPC ci-dessous (service_role).

alter table public.devices add column if not exists device_password text;

update public.devices
  set device_password = extensions.crypt('123456', extensions.gen_salt('bf'))
  where device_password is null;

alter table public.devices
  alter column device_password set default extensions.crypt('123456', extensions.gen_salt('bf'));

alter table public.devices
  alter column device_password set not null;

-- Vérifie le mot de passe device et, si correct, transfère la propriété au nouvel owner.
-- Renvoie true si transféré, false si device introuvable ou mot de passe incorrect.
create or replace function public.device_transfer(p_imei text, p_password text, p_new_owner uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  d public.devices;
begin
  select * into d from public.devices where imei = p_imei;
  if not found then
    return false;
  end if;
  if d.device_password is null or d.device_password <> crypt(p_password, d.device_password) then
    return false;
  end if;
  update public.devices
    set owner_id = p_new_owner, updated_at = now()
    where id = d.id;
  return true;
end;
$$;

-- Change le mot de passe device — PROPRIÉTAIRE uniquement (owner_id = p_owner).
-- Renvoie true si une ligne a été modifiée.
create or replace function public.device_set_password(p_traccar_id integer, p_owner uuid, p_new text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n integer;
begin
  update public.devices
    set device_password = crypt(p_new, gen_salt('bf')), updated_at = now()
    where traccar_id = p_traccar_id and owner_id = p_owner;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Réservé à l'API façade (service_role). Jamais appelable par les clients.
revoke all on function public.device_transfer(text, text, uuid) from public, anon, authenticated;
revoke all on function public.device_set_password(integer, uuid, text) from public, anon, authenticated;
grant execute on function public.device_transfer(text, text, uuid) to service_role;
grant execute on function public.device_set_password(integer, uuid, text) to service_role;
