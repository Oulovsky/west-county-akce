alter table public.zakazky
  add column if not exists cena_techniky numeric not null default 0,
  add column if not exists cena_personalu numeric not null default 0,
  add column if not exists cena_pred_slevou numeric not null default 0,
  add column if not exists cilova_cena numeric null,
  add column if not exists sleva_percent numeric not null default 0,
  add column if not exists konecna_cena numeric not null default 0,
  add column if not exists pricing_updated_at timestamptz null;

alter table public.profiles
  add column if not exists hodinovy_naklad_akce numeric not null default 0;
