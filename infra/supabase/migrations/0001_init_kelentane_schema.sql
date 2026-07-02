-- Kelentane GPS — schéma app multi-tenant (handoff §9.1).
-- Appliqué au projet Supabase kelentane-gps (bgkbkjbjahgmfxcsrqmk, eu-west-3).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.clients (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  phone       text,
  identifier  text unique,
  created_at  timestamptz not null default now()
);

create table public.devices (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.clients(id) on delete cascade,
  traccar_id    integer,
  imei          text not null unique,
  name          text,
  plate         text,
  type          text check (type in ('van','truck','bus','car','moto','taxi','ambulance','other')),
  icon_key      text,
  model         text default 'GT06N',
  sim_operator  text,
  sim_phone     text,
  iccid         text,
  owner_contact text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index devices_owner_idx on public.devices(owner_id);
create trigger devices_set_updated before update on public.devices
  for each row execute function public.set_updated_at();

create table public.device_shares (
  id           uuid primary key default gen_random_uuid(),
  device_id    uuid not null references public.devices(id) on delete cascade,
  created_by   uuid not null references public.clients(id) on delete cascade,
  shared_with  uuid references public.clients(id) on delete set null,
  share_token  text not null unique,
  scope        text not null default 'read' check (scope in ('read','commands')),
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index device_shares_device_idx on public.device_shares(device_id);
create index device_shares_with_idx on public.device_shares(shared_with);

create or replace function public.has_device_access(dev uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.devices d where d.id = dev and d.owner_id = auth.uid())
      or exists (select 1 from public.device_shares s where s.device_id = dev and s.shared_with = auth.uid());
$$;

create table public.custom_geofences (
  id                  uuid primary key default gen_random_uuid(),
  device_id           uuid not null references public.devices(id) on delete cascade,
  traccar_geofence_id integer,
  name                text not null,
  kind                text not null check (kind in ('circle','polygon')),
  area                jsonb,
  color               text,
  enabled             boolean not null default true,
  created_at          timestamptz not null default now()
);
create index custom_geofences_device_idx on public.custom_geofences(device_id);

create table public.notification_prefs (
  client_id  uuid primary key references public.clients(id) on delete cascade,
  armed      boolean not null default true,
  types      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger notif_set_updated before update on public.notification_prefs
  for each row execute function public.set_updated_at();

create table public.sim_billing (
  id              uuid primary key default gen_random_uuid(),
  device_id       uuid not null references public.devices(id) on delete cascade,
  operator        text,
  iccid           text,
  plan            text,
  balance         numeric,
  data_expires_at timestamptz,
  updated_at      timestamptz not null default now()
);
create unique index sim_billing_device_idx on public.sim_billing(device_id);
create trigger sim_set_updated before update on public.sim_billing
  for each row execute function public.set_updated_at();

alter table public.clients            enable row level security;
alter table public.devices            enable row level security;
alter table public.device_shares      enable row level security;
alter table public.custom_geofences   enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.sim_billing        enable row level security;

create policy "clients_self_select" on public.clients for select using (id = auth.uid());
create policy "clients_self_upsert" on public.clients for insert with check (id = auth.uid());
create policy "clients_self_update" on public.clients for update using (id = auth.uid()) with check (id = auth.uid());

create policy "devices_select" on public.devices for select using (public.has_device_access(id));
create policy "devices_insert" on public.devices for insert with check (owner_id = auth.uid());
create policy "devices_update" on public.devices for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "devices_delete" on public.devices for delete using (owner_id = auth.uid());

create policy "shares_select" on public.device_shares for select
  using (created_by = auth.uid() or shared_with = auth.uid()
     or exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid()));
create policy "shares_insert" on public.device_shares for insert
  with check (exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid()));
create policy "shares_update" on public.device_shares for update
  using (exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid()));
create policy "shares_delete" on public.device_shares for delete
  using (exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid()));

create policy "geo_select" on public.custom_geofences for select using (public.has_device_access(device_id));
create policy "geo_insert" on public.custom_geofences for insert
  with check (exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid()));
create policy "geo_update" on public.custom_geofences for update
  using (exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid()));
create policy "geo_delete" on public.custom_geofences for delete
  using (exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid()));

create policy "notif_select" on public.notification_prefs for select using (client_id = auth.uid());
create policy "notif_insert" on public.notification_prefs for insert with check (client_id = auth.uid());
create policy "notif_update" on public.notification_prefs for update using (client_id = auth.uid()) with check (client_id = auth.uid());

create policy "sim_select" on public.sim_billing for select using (public.has_device_access(device_id));
