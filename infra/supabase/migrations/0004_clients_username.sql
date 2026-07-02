-- Auth (étape 9a) : username unique (insensible à la casse) sur les clients.
-- Identité Supabase Auth = email synthétique {username}@kelentane.app.
alter table public.clients add column if not exists username text;
create unique index if not exists clients_username_lower_idx on public.clients (lower(username));

update public.clients set username = 'kelentane-seed'
  where id = '000000aa-0000-0000-0000-0000000000aa' and username is null;
