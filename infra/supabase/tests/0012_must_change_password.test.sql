-- Test de la migration 0012 — clients.must_change_password + is_default_password().
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
  u_default   uuid := gen_random_uuid(); -- création mdp "123456" -> true
  u_chosen    uuid := gen_random_uuid(); -- création mdp choisi -> false
  u_empty     uuid := gen_random_uuid(); -- hash vide ('') -> false, sans exception
  u_legacy    uuid := gen_random_uuid(); -- hash non bcrypt (legacy/corrompu) -> false, sans exception
  u_walkup_a  uuid := gen_random_uuid(); -- backfill : walk-up mdp encore défaut -> true
  u_walkup_b  uuid := gen_random_uuid(); -- backfill : walk-up mdp déjà changé -> false
  d_a uuid := gen_random_uuid();
  d_b uuid := gen_random_uuid();
  v_flag boolean;
  n int := 0;
begin
  ---------------------------------------------------------------------------
  -- (1) Création avec mdp "123456" -> must_change_password = true.
  ---------------------------------------------------------------------------
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', u_default, 'authenticated','authenticated',
          '868000000012001@kelentane.com', crypt('123456', gen_salt('bf')), now(), now(), now());

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_default;
  if v_flag is not true then
    raise exception 'FAIL %: création avec mdp "123456" -> must_change_password devrait être true (obtenu %)', n, v_flag;
  end if;

  ---------------------------------------------------------------------------
  -- (2) Création avec mdp choisi (≠ défaut) -> false.
  ---------------------------------------------------------------------------
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', u_chosen, 'authenticated','authenticated',
          'alioubah77@kelentane.com', crypt('MonVraiMdp!', gen_salt('bf')), now(), now(), now());

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_chosen;
  if v_flag is not false then
    raise exception 'FAIL %: création avec mdp choisi -> must_change_password devrait être false (obtenu %)', n, v_flag;
  end if;

  ---------------------------------------------------------------------------
  -- (3a) Hash vide ('') -> is_default_password() = false, SANS exception.
  ---------------------------------------------------------------------------
  n := n + 1;
  if public.is_default_password('') is not false then
    raise exception 'FAIL %: is_default_password('''') devrait être false', n;
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', u_empty, 'authenticated','authenticated',
          'hash-vide@kelentane.com', '', now(), now(), now());

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_empty;
  if v_flag is not false then
    raise exception 'FAIL %: création avec hash vide -> must_change_password devrait être false (obtenu %)', n, v_flag;
  end if;

  ---------------------------------------------------------------------------
  -- (3b) Hash NON bcrypt (ex. legacy/corrompu, pas de préfixe $2x$) -> false,
  --      SANS exception (bloc EXCEPTION WHEN OTHERS de is_default_password).
  ---------------------------------------------------------------------------
  n := n + 1;
  if public.is_default_password('md5$not-a-bcrypt-hash') is not false then
    raise exception 'FAIL %: is_default_password() sur hash non-bcrypt devrait être false', n;
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', u_legacy, 'authenticated','authenticated',
          'hash-legacy@kelentane.com', 'md5$not-a-bcrypt-hash', now(), now(), now());

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_legacy;
  if v_flag is not false then
    raise exception 'FAIL %: création avec hash non-bcrypt -> must_change_password devrait être false (obtenu %)', n, v_flag;
  end if;

  ---------------------------------------------------------------------------
  -- (4) Changement de mdp vers un mdp CHOISI -> recalcul à false.
  ---------------------------------------------------------------------------
  update auth.users set encrypted_password = crypt('NouveauMdpChoisi!', gen_salt('bf'))
    where id = u_default;

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_default;
  if v_flag is not false then
    raise exception 'FAIL %: changement vers mdp choisi -> must_change_password devrait repasser false (obtenu %)', n, v_flag;
  end if;

  ---------------------------------------------------------------------------
  -- (5) Changement de mdp vers "123456" -> RECALCULÉ à true (pas juste remis
  --     à false inconditionnellement : le flag mesure l'état réel du mdp).
  ---------------------------------------------------------------------------
  update auth.users set encrypted_password = crypt('123456', gen_salt('bf'))
    where id = u_chosen;

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_chosen;
  if v_flag is not true then
    raise exception 'FAIL %: changement vers "123456" -> must_change_password devrait repasser true (obtenu %)', n, v_flag;
  end if;

  -- Un UPDATE qui NE touche PAS encrypted_password ne doit pas re-déclencher
  -- le trigger (AFTER UPDATE OF encrypted_password + WHEN) : aucun effet attendu
  -- (vérifié indirectement : pas d'exception, flag inchangé).
  update auth.users set updated_at = now() where id = u_chosen;
  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_chosen;
  if v_flag is not true then
    raise exception 'FAIL %: un update sans toucher encrypted_password ne devrait pas changer le flag (obtenu %)', n, v_flag;
  end if;

  ---------------------------------------------------------------------------
  -- (6) Backfill (rejoué ici à l'identique de 0012) : ne flip QUE les walk-up
  --     IMEI dont le mdp COMPTE vaut encore le défaut "123456".
  ---------------------------------------------------------------------------
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_walkup_a, 'authenticated','authenticated',
     '868000000012002@kelentane.com', crypt('123456', gen_salt('bf')), now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_walkup_b, 'authenticated','authenticated',
     '868000000012003@kelentane.com', crypt('DejaChange!', gen_salt('bf')), now(), now(), now());
  -- Simule un état "pré-0012" (colonne pas encore alimentée) sur ces fixtures.
  update public.clients set must_change_password = false where id in (u_walkup_a, u_walkup_b);

  insert into public.devices (id, owner_id, imei, traccar_id) values
    (d_a, u_walkup_a, '868000000012002', 940012),
    (d_b, u_walkup_b, '868000000012003', 940013);
  insert into public.device_access (device_id, user_id, role, status) values
    (d_a, u_walkup_a, 'action', 'active'),
    (d_b, u_walkup_b, 'action', 'active');

  -- Ré-exécution de la requête de backfill de 0012, restreinte aux fixtures de ce test.
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
    and public.is_default_password(u.encrypted_password)
    and c.id in (u_walkup_a, u_walkup_b);

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_walkup_a;
  if v_flag is not true then
    raise exception 'FAIL %: backfill aurait dû flipper le walk-up au mdp par défaut (obtenu %)', n, v_flag;
  end if;

  n := n + 1;
  select must_change_password into v_flag from public.clients where id = u_walkup_b;
  if v_flag is not false then
    raise exception 'FAIL %: backfill n''aurait pas dû toucher le walk-up dont le mdp est déjà changé (obtenu %)', n, v_flag;
  end if;

  raise notice 'ALL % ASSERTIONS PASSED', n;
end;
$$;

rollback;
