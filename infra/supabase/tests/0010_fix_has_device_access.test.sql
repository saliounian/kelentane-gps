-- Test de la migration 0010 — H3 : private.has_device_access prend en compte
-- device_access (statut 'active'), en plus de owner_id et device_shares.
--
-- Exécution (base où 0001..0010 sont appliquées) :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/supabase/tests/0010_fix_has_device_access.test.sql
-- ou via Supabase MCP execute_sql / le SQL editor.
--
-- 100 % transactionnel : BEGIN ... ROLLBACK → aucune donnée ne persiste.
-- has_device_access lit auth.uid() → on simule le JWT via set_config('request.jwt.claims', ...).
-- Échec d'une assertion -> RAISE EXCEPTION -> transaction avortée. Succès -> NOTICE final.

begin;

do $$
declare
  u_owner   uuid := gen_random_uuid();  -- propriétaire du device (branche owner_id)
  u_access  uuid := gen_random_uuid();  -- SEULEMENT un device_access actif (le cas H3)
  u_reval   uuid := gen_random_uuid();  -- device_access 'revalidate' (doit rester refusé)
  u_none    uuid := gen_random_uuid();  -- aucun lien (contrôle négatif)
  d_id uuid := gen_random_uuid();
  n int := 0;

  -- Évalue private.has_device_access(d_id) en se faisant passer pour :who: via le JWT.
  function_result boolean;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_owner,  'authenticated','authenticated','h3_owner@test.local',  '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_access, 'authenticated','authenticated','h3_access@test.local', '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_reval,  'authenticated','authenticated','h3_reval@test.local',  '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_none,   'authenticated','authenticated','h3_none@test.local',   '', now(), now(), now());

  insert into public.devices (id, owner_id, imei, traccar_id)
  values (d_id, u_owner, 'IMEI-TEST-H3-0010', 930010);

  -- u_access : accès actif SANS être owner et SANS device_shares → le cœur de H3.
  insert into public.device_access (device_id, user_id, role, status)
  values (d_id, u_access, 'consultation', 'active');
  -- u_reval : accès non actif → ne doit PAS ouvrir l'accès.
  insert into public.device_access (device_id, user_id, role, status)
  values (d_id, u_reval, 'action', 'revalidate');

  -- (1) device_access actif seul → true (comportement corrigé par 0010).
  perform set_config('request.jwt.claims', json_build_object('sub', u_access::text)::text, true);
  function_result := private.has_device_access(d_id);
  n := n + 1;
  if function_result is not true then
    raise exception 'FAIL %: device_access actif seul devrait donner accès (résultat=%)', n, function_result;
  end if;

  -- (2) device_access 'revalidate' → false (filtre statut).
  perform set_config('request.jwt.claims', json_build_object('sub', u_reval::text)::text, true);
  function_result := private.has_device_access(d_id);
  n := n + 1;
  if function_result is not false then
    raise exception 'FAIL %: accès revalidate ne devrait PAS donner accès (résultat=%)', n, function_result;
  end if;

  -- (3) aucun lien → false.
  perform set_config('request.jwt.claims', json_build_object('sub', u_none::text)::text, true);
  function_result := private.has_device_access(d_id);
  n := n + 1;
  if function_result is not false then
    raise exception 'FAIL %: compte sans lien ne devrait PAS avoir accès (résultat=%)', n, function_result;
  end if;

  -- (4) owner → true (branche historique non régressée).
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner::text)::text, true);
  function_result := private.has_device_access(d_id);
  n := n + 1;
  if function_result is not true then
    raise exception 'FAIL %: le propriétaire devrait garder l''accès (résultat=%)', n, function_result;
  end if;

  raise notice 'ALL % ASSERTIONS PASSED', n;
end;
$$;

rollback;
