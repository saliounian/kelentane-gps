-- 0008 — Rate-limit du LOGIN par IMEI (§3.5), partagé avec l'ajout de device :
-- même table device_auth_attempts, même fenêtre (5 tentatives / 15 min).
-- Le login IMEI est routé via l'API façade (POST /auth/imei-login) précisément
-- pour que ce rate-limit s'applique aussi à la connexion, pas seulement à l'ajout.

-- true si l'IMEI est actuellement bloqué (>= 5 échecs dans la fenêtre).
-- Réinitialise la fenêtre si elle est expirée. Amorce une ligne sinon.
create or replace function public.device_attempts_blocked(p_imei text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  a public.device_auth_attempts;
  win interval := interval '15 minutes';
begin
  select * into a from public.device_auth_attempts where imei = p_imei for update;
  if found and a.window_start > now() - win and a.attempts >= 5 then
    return true;
  end if;
  if not found or a.window_start <= now() - win then
    insert into public.device_auth_attempts (imei, attempts, window_start)
    values (p_imei, 0, now())
    on conflict (imei) do update set attempts = 0, window_start = now();
  end if;
  return false;
end;
$$;

-- Incrémente (échec) ou remet à zéro (succès) le compteur de l'IMEI.
create or replace function public.device_attempts_bump(p_imei text, p_reset boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_reset then
    update public.device_auth_attempts set attempts = 0, window_start = now() where imei = p_imei;
  else
    update public.device_auth_attempts set attempts = attempts + 1 where imei = p_imei;
  end if;
end;
$$;

revoke all on function public.device_attempts_blocked(text)        from public, anon, authenticated;
revoke all on function public.device_attempts_bump(text, boolean)  from public, anon, authenticated;
grant execute on function public.device_attempts_blocked(text)       to service_role;
grant execute on function public.device_attempts_bump(text, boolean) to service_role;
