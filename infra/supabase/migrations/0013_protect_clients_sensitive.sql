create or replace function public.protect_clients_sensitive()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.parent_account_id := null;
      new.must_change_password := false;
    else
      new.is_admin := old.is_admin;
      new.parent_account_id := old.parent_account_id;
      new.must_change_password := old.must_change_password;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_clients_sensitive on public.clients;
create trigger protect_clients_sensitive
  before insert or update on public.clients
  for each row execute function public.protect_clients_sensitive();

revoke insert, update on public.clients from anon;
