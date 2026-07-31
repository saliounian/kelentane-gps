-- 0010 — H3 : private.has_device_access ignorait la table device_access (modèle
-- multi-comptes de 0007). Un accès valide via device_access était donc invisible
-- pour RLS (devices_select / geo_select / sim_select), et inversement.
--
-- L'API façade utilise service_role (RLS bypass) → H3 n'impacte pas l'app aujourd'hui,
-- mais la fonction doit refléter le vrai modèle d'accès pour tout futur client soumis
-- à RLS (UI web, clé authenticated).
--
-- On ajoute la branche device_access (statut 'active' uniquement, cohérent avec
-- AccessService.allowed côté API) aux deux branches existantes (owner_id, device_shares).

create or replace function private.has_device_access(dev uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.devices d where d.id = dev and d.owner_id = auth.uid())
      or exists (select 1 from public.device_shares s where s.device_id = dev and s.shared_with = auth.uid())
      or exists (select 1 from public.device_access a where a.device_id = dev and a.user_id = auth.uid() and a.status = 'active');
$$;
