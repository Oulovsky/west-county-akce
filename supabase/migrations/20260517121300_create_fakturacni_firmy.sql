create table if not exists public.fakturacni_firmy (
  id uuid primary key default gen_random_uuid(),
  nazev text not null,
  ulice text null,
  mesto text null,
  psc text null,
  ico text null,
  dic text null,
  email text null,
  telefon text null,
  bankovni_ucet text null,
  iban text null,
  swift text null,
  poznamka text null,
  aktivni boolean not null default true,
  vychozi boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zakazky
  add column if not exists fakturacni_firma_id uuid null references public.fakturacni_firmy(id);

create unique index if not exists fakturacni_firmy_single_default_idx
  on public.fakturacni_firmy (vychozi)
  where vychozi = true and aktivni = true;

create index if not exists fakturacni_firmy_aktivni_idx
  on public.fakturacni_firmy (aktivni, vychozi, nazev);

alter table public.fakturacni_firmy enable row level security;

drop policy if exists "Authenticated users can read fakturacni_firmy" on public.fakturacni_firmy;
create policy "Authenticated users can read fakturacni_firmy"
on public.fakturacni_firmy
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage fakturacni_firmy" on public.fakturacni_firmy;
create policy "Authenticated users can manage fakturacni_firmy"
on public.fakturacni_firmy
for all
to authenticated
using (true)
with check (true);
