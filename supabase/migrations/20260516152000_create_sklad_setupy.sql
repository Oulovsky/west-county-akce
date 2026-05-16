create extension if not exists pgcrypto;

create table if not exists public.setupy (
  setup_id uuid primary key default gen_random_uuid(),
  nazev text not null,
  popis text null,
  aktivni boolean not null default true,
  poradi integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.setupy
  add column if not exists popis text null;

alter table public.setupy
  add column if not exists aktivni boolean not null default true;

alter table public.setupy
  add column if not exists poradi integer not null default 0;

alter table public.setupy
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.setup_polozky (
  setup_polozka_id uuid primary key default gen_random_uuid(),
  setup_id uuid not null references public.setupy(setup_id) on delete cascade,
  skladova_polozka_id uuid not null references public.skladove_polozky(skladova_polozka_id) on delete restrict,
  mnozstvi numeric not null default 1,
  poznamka text null,
  poradi integer not null default 0,
  created_at timestamptz not null default now(),
  constraint setup_polozky_mnozstvi_positive check (mnozstvi > 0)
);

alter table public.setup_polozky
  add column if not exists mnozstvi numeric not null default 1;

alter table public.setup_polozky
  add column if not exists poznamka text null;

alter table public.setup_polozky
  add column if not exists poradi integer not null default 0;

alter table public.setup_polozky
  add column if not exists created_at timestamptz not null default now();

create index if not exists setupy_aktivni_poradi_idx
  on public.setupy (aktivni, poradi, nazev);

create index if not exists setup_polozky_setup_poradi_idx
  on public.setup_polozky (setup_id, poradi);

create index if not exists setup_polozky_skladova_polozka_id_idx
  on public.setup_polozky (skladova_polozka_id);

create unique index if not exists setup_polozky_setup_polozka_unique_idx
  on public.setup_polozky (setup_id, skladova_polozka_id);
