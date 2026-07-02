-- Jetons push (FCM/APNs/Expo) par client, pour l'envoi d'alarmes (étape 6).
create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('ios','android','web')),
  updated_at timestamptz not null default now()
);
create index push_tokens_client_idx on public.push_tokens(client_id);
create trigger push_tokens_set_updated before update on public.push_tokens
  for each row execute function public.set_updated_at();

alter table public.push_tokens enable row level security;
create policy "push_self_select" on public.push_tokens for select using (client_id = auth.uid());
create policy "push_self_insert" on public.push_tokens for insert with check (client_id = auth.uid());
create policy "push_self_update" on public.push_tokens for update using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "push_self_delete" on public.push_tokens for delete using (client_id = auth.uid());
