-- Test de la migration 0009 — fix H2 (device_set_password exige role='action')
-- + device_admin_reset_password (reset admin sans device_access).
--
-- Exécution (sur une base où 0001..0009 sont appliquées) :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/supabase/tests/0009_admin_password_reset.test.sql
-- ou via Supabase MCP execute_sql / le SQL editor.
--
-- 100 % transactionnel : BEGIN ... ROLLBACK → aucune donnée ne persiste.
-- Une assertion qui échoue -> RAISE EXCEPTION -> transaction avortée -> échec visible.
-- Succès -> NOTICE "ALL 13 ASSERTIONS PASSED".

begin;

do $$
declare
  -- comptes
  u_action        uuid := gen_random_uuid();  -- accès role='action'  (peut changer le mdp)
  u_consult       uuid := gen_random_uuid();  -- accès role='consultation' (ne doit PAS pouvoir)
  u_admin         uuid := gen_random_uuid();  -- is_admin=true, enfant de u_admin_parent
  u_admin_parent  uuid := gen_random_uuid();  -- is_admin=true, parent de u_admin
  u_other         uuid := gen_random_uuid();  -- badaud sans privilège
  -- devices (traccar_id sert de clé d'appel aux RPC)
  d_a uuid := gen_random_uuid();  -- traccar 900001 — scénario consultation refusée
  d_b uuid := gen_random_uuid();  -- traccar 900002 — scénario action autorisée
  d_c uuid := gen_random_uuid();  -- traccar 900003 — scénario reset admin sur device sans accès
  d_d uuid := gen_random_uuid();  -- traccar 900004 — scénario revalidation post-reset admin
  v_bool boolean;
  v_status text;
  n int := 0;
begin
  ---------------------------------------------------------------------------
  -- Fixtures : insert auth.users -> trigger handle_new_user crée clients.
  ---------------------------------------------------------------------------
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_action,       'authenticated','authenticated','t_action@test.local',       '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_consult,      'authenticated','authenticated','t_consult@test.local',      '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_admin,        'authenticated','authenticated','t_admin@test.local',        '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_admin_parent, 'authenticated','authenticated','t_admin_parent@test.local', '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_other,        'authenticated','authenticated','t_other@test.local',        '', now(), now(), now());

  -- Rôles admin + lien parent (les lignes clients existent déjà via trigger 0006).
  update public.clients set is_admin = true                          where id = u_admin_parent;
  update public.clients set is_admin = true, parent_account_id = u_admin_parent where id = u_admin;

  -- Devices (device_password prend son défaut hashé '123456' via 0005).
  insert into public.devices (id, owner_id, imei, traccar_id) values
    (d_a, u_consult,      'IMEI-TEST-900001', 900001),
    (d_b, u_action,       'IMEI-TEST-900002', 900002),
    (d_c, u_other,        'IMEI-TEST-900003', 900003),
    (d_d, u_admin_parent, 'IMEI-TEST-900004', 900004);

  -- Accès.
  insert into public.device_access (device_id, user_id, role, status) values
    (d_a, u_consult,      'consultation', 'active'),   -- test a
    (d_b, u_action,       'action',       'active'),   -- test b (acteur)
    (d_b, u_other,        'action',       'active'),   -- test b (badaud -> doit passer revalidate)
    (d_c, u_other,        'action',       'active'),   -- test c (badaud sur device que l'admin reset)
    (d_d, u_admin,        'action',       'active'),   -- test d (acteur admin)
    (d_d, u_admin_parent, 'action',       'active'),   -- test d (parent admin -> reste active)
    (d_d, u_other,        'action',       'active');   -- test d (autre -> revalidate)

  ---------------------------------------------------------------------------
  -- (a) role='consultation' NE PEUT PLUS appeler device_set_password.
  ---------------------------------------------------------------------------
  v_bool := public.device_set_password(900001, u_consult, 'HACKED');
  n := n + 1;
  if v_bool is not false then
    raise exception 'FAIL %: consultation a pu changer le mdp (retour=%)', n, v_bool;
  end if;

  n := n + 1;
  if not exists (select 1 from public.devices
                 where traccar_id = 900001 and device_password = crypt('123456', device_password)) then
    raise exception 'FAIL %: mdp de d_a modifié alors que l''appel devait échouer', n;
  end if;

  n := n + 1;
  select status into v_status from public.device_access where device_id = d_a and user_id = u_consult;
  if v_status <> 'active' then
    raise exception 'FAIL %: accès consultation a été altéré (status=%) sur échec', n, v_status;
  end if;

  ---------------------------------------------------------------------------
  -- (b) role='action' PEUT toujours appeler device_set_password.
  ---------------------------------------------------------------------------
  v_bool := public.device_set_password(900002, u_action, 'ACTIONPW');
  n := n + 1;
  if v_bool is not true then
    raise exception 'FAIL %: action n''a PAS pu changer le mdp (retour=%)', n, v_bool;
  end if;

  n := n + 1;
  if not exists (select 1 from public.devices
                 where traccar_id = 900002 and device_password = crypt('ACTIONPW', device_password)) then
    raise exception 'FAIL %: mdp de d_b non mis à jour après appel action', n;
  end if;

  n := n + 1;
  select status into v_status from public.device_access where device_id = d_b and user_id = u_other;
  if v_status <> 'revalidate' then
    raise exception 'FAIL %: badaud d_b aurait dû passer revalidate (status=%)', n, v_status;
  end if;

  ---------------------------------------------------------------------------
  -- (c) is_admin=true reset N'IMPORTE QUEL device, même SANS device_access.
  ---------------------------------------------------------------------------
  -- Garde-fou : non-admin refusé.
  v_bool := public.device_admin_reset_password(900003, u_consult, 'NOPE');
  n := n + 1;
  if v_bool is not false then
    raise exception 'FAIL %: non-admin a pu appeler device_admin_reset_password (retour=%)', n, v_bool;
  end if;

  -- Admin autorisé alors qu'il n'a AUCUN device_access sur d_c.
  n := n + 1;
  if exists (select 1 from public.device_access where device_id = d_c and user_id = u_admin) then
    raise exception 'FAIL %: préparation invalide, l''admin ne doit pas avoir d''accès sur d_c', n;
  end if;
  v_bool := public.device_admin_reset_password(900003, u_admin, 'ADMPW');
  if v_bool is not true then
    raise exception 'FAIL %: admin n''a PAS pu reset un device sans accès (retour=%)', n, v_bool;
  end if;

  n := n + 1;
  if not exists (select 1 from public.devices
                 where traccar_id = 900003 and device_password = crypt('ADMPW', device_password)) then
    raise exception 'FAIL %: mdp de d_c non mis à jour après reset admin', n;
  end if;

  ---------------------------------------------------------------------------
  -- (d) Post-reset admin : acteur + parent (si admin) restent 'active' ;
  --     tous les autres passent 'revalidate'.
  ---------------------------------------------------------------------------
  v_bool := public.device_admin_reset_password(900004, u_admin, 'RSTPW');
  n := n + 1;
  if v_bool is not true then
    raise exception 'FAIL %: reset admin sur d_d a échoué (retour=%)', n, v_bool;
  end if;

  n := n + 1;
  select status into v_status from public.device_access where device_id = d_d and user_id = u_admin;
  if v_status <> 'active' then
    raise exception 'FAIL %: acteur admin aurait dû rester active (status=%)', n, v_status;
  end if;

  n := n + 1;
  select status into v_status from public.device_access where device_id = d_d and user_id = u_admin_parent;
  if v_status <> 'active' then
    raise exception 'FAIL %: parent admin aurait dû rester active (status=%)', n, v_status;
  end if;

  n := n + 1;
  select status into v_status from public.device_access where device_id = d_d and user_id = u_other;
  if v_status <> 'revalidate' then
    raise exception 'FAIL %: autre compte aurait dû passer revalidate (status=%)', n, v_status;
  end if;

  raise notice 'ALL % ASSERTIONS PASSED', n;
end;
$$;

rollback;
