-- Durcissement advisors : sortir la fonction SECURITY DEFINER de l'API exposée
-- + fixer le search_path des fonctions. (Advisors sécurité = 0 après application.)
create schema if not exists private;

create or replace function private.has_device_access(dev uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.devices d where d.id = dev and d.owner_id = auth.uid())
      or exists (select 1 from public.device_shares s where s.device_id = dev and s.shared_with = auth.uid());
$$;

grant usage on schema private to authenticated, service_role;
grant execute on function private.has_device_access(uuid) to authenticated, service_role;

drop policy "devices_select" on public.devices;
create policy "devices_select" on public.devices for select using (private.has_device_access(id));

drop policy "geo_select" on public.custom_geofences;
create policy "geo_select" on public.custom_geofences for select using (private.has_device_access(device_id));

drop policy "sim_select" on public.sim_billing;
create policy "sim_select" on public.sim_billing for select using (private.has_device_access(device_id));

drop function public.has_device_access(uuid);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
