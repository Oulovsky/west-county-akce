create table if not exists public.vozidla (
  id uuid primary key default gen_random_uuid(),
  nazev text not null,
  spz text null,
  typ text not null,
  vlastnik_user_id uuid null,
  aktivni boolean not null default true,
  kapacita_osob integer null,
  kapacita_poznamka text null,
  poznamka text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vozidla_typ_check check (typ in ('firemni', 'soukrome')),
  constraint vozidla_kapacita_osob_check check (kapacita_osob is null or kapacita_osob >= 0)
);

create table if not exists public.zakazka_doprava (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky(zakazka_id) on delete cascade,
  vozidlo_id uuid null references public.vozidla(id) on delete set null,
  typ_dopravy text not null,
  user_id uuid null,
  odjezd_at timestamptz null,
  prijezd_at timestamptz null,
  odkud text null,
  kam text null,
  poznamka text null,
  override_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zakazka_doprava_typ_check
    check (typ_dopravy in ('firemni_auto', 'soukrome_auto', 'pouze_presun_cloveka')),
  constraint zakazka_doprava_prijezd_after_odjezd_check
    check (odjezd_at is null or prijezd_at is null or prijezd_at >= odjezd_at)
);

create table if not exists public.cestovni_nahrady (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky(zakazka_id) on delete cascade,
  user_id uuid not null,
  zakazka_doprava_id uuid null references public.zakazka_doprava(id) on delete set null,
  km numeric not null,
  sazba_za_km numeric not null,
  castka numeric generated always as (km * sazba_za_km) stored,
  odkud text null,
  kam text null,
  poznamka text null,
  status text not null default 'ceka_na_schvaleni',
  submitted_at timestamptz not null default now(),
  approved_by uuid null,
  approved_at timestamptz null,
  rejected_reason text null,
  paid_by uuid null,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cestovni_nahrady_km_check check (km > 0),
  constraint cestovni_nahrady_sazba_check check (sazba_za_km >= 0),
  constraint cestovni_nahrady_status_check
    check (status in ('ceka_na_schvaleni', 'schvaleno', 'zamitnuto', 'proplaceno')),
  constraint cestovni_nahrady_rejected_reason_check
    check (status <> 'zamitnuto' or nullif(btrim(coalesce(rejected_reason, '')), '') is not null)
);

create index if not exists vozidla_typ_aktivni_idx
  on public.vozidla (typ, aktivni);

create index if not exists vozidla_vlastnik_idx
  on public.vozidla (vlastnik_user_id);

create index if not exists zakazka_doprava_zakazka_idx
  on public.zakazka_doprava (zakazka_id, odjezd_at);

create index if not exists zakazka_doprava_vozidlo_cas_idx
  on public.zakazka_doprava (vozidlo_id, odjezd_at, prijezd_at)
  where vozidlo_id is not null;

create index if not exists zakazka_doprava_user_cas_idx
  on public.zakazka_doprava (user_id, odjezd_at, prijezd_at)
  where user_id is not null;

create index if not exists cestovni_nahrady_zakazka_idx
  on public.cestovni_nahrady (zakazka_id, submitted_at desc);

create index if not exists cestovni_nahrady_user_status_idx
  on public.cestovni_nahrady (user_id, status, submitted_at desc);

alter table public.vozidla enable row level security;
alter table public.zakazka_doprava enable row level security;
alter table public.cestovni_nahrady enable row level security;

drop policy if exists "Interni uzivatele ctou vozidla" on public.vozidla;
drop policy if exists "Admin spravuje vozidla" on public.vozidla;
drop policy if exists "Interni uzivatele ctou dopravu" on public.zakazka_doprava;
drop policy if exists "Sef spravuje dopravu" on public.zakazka_doprava;
drop policy if exists "Interni uzivatele ctou cestovni nahrady" on public.cestovni_nahrady;
drop policy if exists "Zamestnanec zadava vlastni cestovni nahrady" on public.cestovni_nahrady;
drop policy if exists "Sef spravuje cestovni nahrady" on public.cestovni_nahrady;

create policy "Interni uzivatele ctou vozidla"
on public.vozidla
for select
to authenticated
using (true);

create policy "Admin spravuje vozidla"
on public.vozidla
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef')
  )
);

create policy "Interni uzivatele ctou dopravu"
on public.zakazka_doprava
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef', 'skladnik')
  )
);

create policy "Sef spravuje dopravu"
on public.zakazka_doprava
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef')
  )
);

create policy "Interni uzivatele ctou cestovni nahrady"
on public.cestovni_nahrady
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef')
  )
);

create policy "Zamestnanec zadava vlastni cestovni nahrady"
on public.cestovni_nahrady
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Sef spravuje cestovni nahrady"
on public.cestovni_nahrady
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef')
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef')
  )
);
