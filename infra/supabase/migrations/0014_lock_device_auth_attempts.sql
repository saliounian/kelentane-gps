revoke all on table public.device_auth_attempts from anon, authenticated;
alter table public.device_auth_attempts enable row level security;
