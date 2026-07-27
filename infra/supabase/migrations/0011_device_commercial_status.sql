-- 0011 — Statut COMMERCIAL des devices (stock / sold), dimension WEB uniquement.
--
-- Deux dimensions DISTINCTES, à ne pas confondre :
--   • commercial_status ('stock' | 'sold')  ← AJOUTÉ ICI. Cycle de vie inventaire.
--       'stock' : device jamais connecté, encore en inventaire.
--       'sold'  : device connecté au moins une fois → considéré vendu.
--                 Passage AUTOMATIQUE et IRRÉVERSIBLE (auto) à la 1re position Traccar.
--   • online/offline (statut temps réel Traccar)  ← EXISTE DÉJÀ, non touché ici.
--
-- Périmètre : exposé UNIQUEMENT via les endpoints /admin/* (AdminGuard, UI web).
-- Aucun endpoint mobile (GET /vehicles…) ne renvoie ce champ — VehicleVM est une
-- whitelist explicite, le mapper ne copie jamais commercial_status.
--
-- Backfill : AUCUN backfill SQL approximatif. Supabase ne voit pas les positions
-- Traccar (stack externe), et `traccar_id` est posé dès l'enrôlement (donc ne
-- distingue pas le stock entrepôt d'un device réellement connecté). Tout device
-- existant démarre donc 'stock' ; l'auto-passage stock→sold (déclenché côté API à
-- la 1re position temps réel) corrige de lui-même les devices déjà connectés à leur
-- prochaine trame. Zéro faux positif, self-healing (choix produit du 2026-07-27).

alter table public.devices
  add column if not exists commercial_status text not null default 'stock'
    check (commercial_status in ('stock', 'sold')),
  add column if not exists first_connected_at timestamptz;

-- Agrégat stats (GET /admin/devices/stats) : petit inventaire, mais l'index garde
-- le comptage par statut O(index) et sert aussi le WHERE commercial_status='stock'
-- de l'auto-passage.
create index if not exists devices_commercial_status_idx
  on public.devices (commercial_status);

comment on column public.devices.commercial_status is
  'Cycle inventaire : stock (jamais connecté) | sold (connecté ≥1 fois, irréversible auto). Distinct de online/offline Traccar. Exposé web/admin uniquement.';
comment on column public.devices.first_connected_at is
  'Horodatage de la 1re connexion Traccar = passage stock→sold. NULL tant que stock.';
