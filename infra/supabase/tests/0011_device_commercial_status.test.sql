-- Test de la migration 0011 — commercial_status stock/sold + auto-passage.
--
-- Exécution (base où 0001..0011 sont appliquées) :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/supabase/tests/0011_device_commercial_status.test.sql
-- ou via Supabase MCP execute_sql / le SQL editor.
--
-- 100 % transactionnel : BEGIN ... ROLLBACK → aucune donnée ne persiste.
-- Échec d'une assertion -> RAISE EXCEPTION -> transaction avortée. Succès -> NOTICE final.

begin;

do $$
declare
  u_owner uuid := gen_random_uuid();
  d_id    uuid := gen_random_uuid();
  cs      text;
  fca     timestamptz;
  flipped int;
  n int := 0;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', u_owner, 'authenticated','authenticated',
          'cs_owner@test.local', '', now(), now(), now());

  insert into public.devices (id, owner_id, imei, traccar_id)
  values (d_id, u_owner, 'IMEI-TEST-CS-0011', 940011);

  -- (1) défaut = 'stock', first_connected_at NULL.
  select commercial_status, first_connected_at into cs, fca from public.devices where id = d_id;
  n := n + 1;
  if cs is distinct from 'stock' or fca is not null then
    raise exception 'FAIL %: défaut attendu stock/NULL, obtenu %/%', n, cs, fca;
  end if;

  -- (2) CHECK : un statut hors liste est rejeté.
  n := n + 1;
  begin
    update public.devices set commercial_status = 'leased' where id = d_id;
    raise exception 'FAIL %: CHECK aurait dû rejeter commercial_status=leased', n;
  exception when check_violation then null; -- attendu
  end;

  -- (3) auto-passage : UPDATE conditionnel WHERE commercial_status='stock' flippe une fois.
  update public.devices
    set commercial_status = 'sold', first_connected_at = now()
    where imei = 'IMEI-TEST-CS-0011' and commercial_status = 'stock';
  get diagnostics flipped = row_count;
  n := n + 1;
  if flipped <> 1 then
    raise exception 'FAIL %: 1re connexion devrait flipper exactement 1 ligne, obtenu %', n, flipped;
  end if;
  select commercial_status, first_connected_at into cs, fca from public.devices where id = d_id;
  if cs is distinct from 'sold' or fca is null then
    raise exception 'FAIL %: après flip attendu sold/non-NULL, obtenu %/%', n, cs, fca;
  end if;

  -- (4) idempotence : re-jouer l'UPDATE conditionnel ne touche AUCUNE ligne (déjà sold).
  update public.devices
    set commercial_status = 'sold', first_connected_at = now()
    where imei = 'IMEI-TEST-CS-0011' and commercial_status = 'stock';
  get diagnostics flipped = row_count;
  n := n + 1;
  if flipped <> 0 then
    raise exception 'FAIL %: device déjà sold ne devrait pas être réécrit (lignes=%)', n, flipped;
  end if;

  raise notice 'ALL % ASSERTIONS PASSED', n;
end;
$$;

rollback;
