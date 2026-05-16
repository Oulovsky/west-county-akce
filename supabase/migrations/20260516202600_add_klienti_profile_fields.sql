alter table public.klienti
  add column if not exists ulice text null,
  add column if not exists mesto text null,
  add column if not exists psc text null,
  add column if not exists ico text null,
  add column if not exists dic text null,
  add column if not exists telefon text null,
  add column if not exists email text null,
  add column if not exists poznamka text null;
