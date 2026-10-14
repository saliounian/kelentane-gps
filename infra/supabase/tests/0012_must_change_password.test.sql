-- Test de la migration 0012 — clients.must_change_password.
--
-- Exécution (sur une base où 0001..0012 sont appliquées) :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/supabase/tests/0012_must_change_password.test.sql
-- ou via Supabase MCP execute_sql / le SQL editor.
--
-- 100 % transactionnel : BEGIN ... ROLLBACK → aucune donnée ne persiste.
-- Une assertion qui échoue -> RAISE EXCEPTION -> transaction avortée -> échec visible.

begin;

do $$
declare
  u_walkup_unused  uuid := gen_random_uuid(); -- walk-up IMEI, mdp jamais changé -> doit flip true à la création
  u_walkup_changed uuid := gen_random_uuid(); -- walk-up IMEI, mdp déjà changé -> doit rester false
  u_regular        uuid := gen_random_uuid(); -- inscription normale, mdp choisi -> doit rester false
  d_unused  uuid := gen_random_uuid();
  d_changed uuid := gen_random_uuid();
  v_flag boolean;
  n int := 0;
begin
  ---------------------------------------------------------------------------
  -- (a) Pose à la création : mdp COMPTE = défaut "123456" -> true immédiat.
  ---------------------------------------------------------------------------
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', u_walkup_unused, 'authenticated','authenticated',
          '868000000012001@kelentane.com', crypt('123456', gen_salt('bf')), now(), now(), now());

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_walkup_unused;
  if v_flag is not true then
    raise exception 'FAIL %: création avec mdp défaut -> must_change_password devrait être true (obtenu %)', n, v_flag;
  end if;

  ---------------------------------------------------------------------------
  -- (b) Pose à la création : mdp COMPTE choisi (≠ défaut) -> false.
  ---------------------------------------------------------------------------
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', u_regular, 'authenticated','authenticated',
          'alioubah77@kelentane.com', crypt('MonVraiMdp!', gen_salt('bf')), now(), now(), now());

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_regular;
  if v_flag is not false then
    raise exception 'FAIL %: inscription normale (mdp choisi) -> must_change_password devrait être false (obtenu %)', n, v_flag;
  end if;

  ---------------------------------------------------------------------------
  -- (c) Remise à false quand le mdp COMPTE change (flux mobile direct Supabase Auth).
  ---------------------------------------------------------------------------
  update auth.users set encrypted_password = crypt('NouveauMdpChoisi!', gen_salt('bf'))
    where id = u_walkup_unused;

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_walkup_unused;
  if v_flag is not false then
    raise exception 'FAIL %: changement de mdp compte -> must_change_password devrait repasser false (obtenu %)', n, v_flag;
  end if;

  ---------------------------------------------------------------------------
  -- (d) Backfill (rejoué ici à l'identique de 0012) : ne flip QUE les walk-up
  --     IMEI dont le mdp COMPTE vaut encore le défaut "123456".
  ---------------------------------------------------------------------------
  -- Fixture walk-up dont le mdp est déjà changé AVANT le backfill (doit rester false).
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', u_walkup_changed, 'authenticated','authenticated',
          '868000000012002@kelentane.com', crypt('DejaChange!', gen_salt('bf')), now(), now(), now());
  update public.clients set must_change_password = false where id in (u_walkup_changed, u_regular);

  insert into public.devices (id, owner_id, imei, traccar_id) values
    (d_unused,  u_walkup_unused,  '868000000012001', 940012),
    (d_changed, u_walkup_changed, '868000000012002', 940013);
  insert into public.device_access (device_id, user_id, role, status) values
    (d_unused,  u_walkup_unused,  'action', 'active'),
    (d_changed, u_walkup_changed, 'action', 'active');

  -- Ré-exécution de la requête de backfill de 0012.
  update public.clients c
  set must_change_password = true
  from auth.users u
  where u.id = c.id
    and c.must_change_password = false
    and exists (
      select 1
      from public.devices d
      join public.device_access da on da.device_id = d.id and da.user_id = c.id and da.role = 'action'
      where d.imei = split_part(u.email, '@', 1)
    )
    and crypt('123456', u.encrypted_password) = u.encrypted_password
    and c.id in (u_walkup_unused, u_walkup_changed, u_regular); -- restreint aux fixtures de ce test

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_walkup_unused;
  if v_flag is not false then
    raise exception 'FAIL %: backfill n''aurait pas dû re-flipper un walk-up dont le mdp compte a déjà changé (obtenu %)', n, v_flag;
  end if;

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_walkup_changed;
  if v_flag is not false then
    raise exception 'FAIL %: backfill n''aurait pas dû flipper un walk-up dont le mdp compte est déjà changé (obtenu %)', n, v_flag;
  end if;

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_regular;
  if v_flag is not false then
    raise exception 'FAIL %: backfill n''aurait pas dû toucher un compte non walk-up (obtenu %)', n, v_flag;
  end if;

  raise notice 'ALL % ASSERTIONS PASSED', n;
end;
$$;

rollback;
