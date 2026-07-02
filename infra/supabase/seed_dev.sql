-- Seed de DÉVELOPPEMENT (persistance étape 5 avant l'auth). Idempotent.
-- Crée un propriétaire seed (auth.users + clients) et un device métier associé
-- à l'IMEI du simulateur GT06. À NE PAS appliquer en production.
--
-- SEED_OWNER_ID (api/.env) doit valoir 000000aa-0000-0000-0000-0000000000aa.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '000000aa-0000-0000-0000-0000000000aa',
  'authenticated', 'authenticated', 'dev-seed@kelentane.local', '',
  now(), now(), now(), '{"provider":"seed"}'::jsonb, '{}'::jsonb
) on conflict (id) do nothing;

insert into public.clients (id, name, phone, identifier) values (
  '000000aa-0000-0000-0000-0000000000aa', 'Salihou Diallo (seed)', '+221 76 412 52 21', 'kelentane-seed'
) on conflict (id) do nothing;

insert into public.devices (
  owner_id, traccar_id, imei, name, plate, type, sim_operator, sim_phone, iccid, owner_contact, icon_key
) values (
  '000000aa-0000-0000-0000-0000000000aa', null, '356789123456781',
  'Peugeot Expert', 'DK-3048-AB', 'van', 'Orange SN', '+221 77 845 12 30',
  '8922 1100 0034 5678 901', 'Salihou D. · +221 76 412 52 21', 'truck'
) on conflict (imei) do nothing;
