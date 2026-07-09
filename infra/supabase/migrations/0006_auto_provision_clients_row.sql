-- 0006 — Auto-provision d'une ligne `clients` pour tout compte auth.
--
-- Contexte : la FK devices.owner_id -> clients.id impose qu'un propriétaire de
-- device ait une ligne clients. Le flux d'inscription de l'app la crée, MAIS un
-- compte créé via le Dashboard Supabase ("Add user") n'en a pas → l'enrôlement /
-- l'adoption d'un device échouait (FK) et, via l'ancien upsert, retombait sur une
-- fixture (seedOwner). On garantit désormais la ligne clients pour TOUT compte,
-- quel que soit le flux de création.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clients (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill des comptes auth existants sans ligne clients (ex. comptes Dashboard).
insert into public.clients (id, name)
select u.id, split_part(u.email, '@', 1)
from auth.users u
left join public.clients c on c.id = u.id
where c.id is null
on conflict (id) do nothing;
