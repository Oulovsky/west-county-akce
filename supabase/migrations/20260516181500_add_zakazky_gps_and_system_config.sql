alter table public.zakazky
  add column if not exists misto_lat numeric null,
  add column if not exists misto_lng numeric null,
  add column if not exists misto_gps_radius_m numeric null default 300,
  add column if not exists misto_gps_presnost_m numeric null,
  add column if not exists misto_gps_zdroj text null,
  add column if not exists misto_gps_updated_at timestamptz null;

create table if not exists public.system_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.system_config (key, value)
values (
  'sklad_gps_zona',
  jsonb_build_object('lat', null, 'lng', null, 'radius_m', 100)
)
on conflict (key) do nothing;
