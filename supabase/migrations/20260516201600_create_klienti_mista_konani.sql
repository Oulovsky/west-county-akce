create table if not exists public.klienti (
  klient_id uuid primary key default gen_random_uuid(),
  nazev text not null,
  aktivni boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mista_konani (
  misto_id uuid primary key default gen_random_uuid(),
  klient_id uuid null references public.klienti(klient_id),
  nazev text not null,
  adresa_text text null,
  lat numeric null,
  lng numeric null,
  radius_m numeric null default 300,
  poznamka text null,
  aktivni boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zakazky
  add column if not exists klient_id uuid null references public.klienti(klient_id),
  add column if not exists misto_id uuid null references public.mista_konani(misto_id);
