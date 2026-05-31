-- FÁZE 3.3a: DB základ klientské zóny — účty, poptávky, rozšíření setupů.
-- Klient ≠ profiles. Poptávka ≠ zakázka. Setupy zůstávají jednotný interní katalog.

-- ---------------------------------------------------------------------------
-- 1) Rozšíření setupy (jednotný katalog, bez klientské kopie)
-- ---------------------------------------------------------------------------

alter table public.setupy
  add column if not exists oblast text not null default 'other',
  add column if not exists dostupne_v_portalu boolean not null default false,
  add column if not exists portal_popis text null;

alter table public.setupy
  drop constraint if exists setupy_oblast_check;

alter table public.setupy
  add constraint setupy_oblast_check
  check (oblast in ('stage', 'sound', 'lights', 'led_wall', 'video', 'dron', 'other'));

create index if not exists setupy_portal_idx
  on public.setupy (aktivni, dostupne_v_portalu, oblast, poradi, nazev);

comment on column public.setupy.oblast is
  'Oblast setupu pro interní i klientský výběr (Stage, Sound, …).';
comment on column public.setupy.dostupne_v_portalu is
  'Klient smí setup vidět a vybrat v poptávce (navíc aktivni = true).';
comment on column public.setupy.portal_popis is
  'Krátký popis pro klientský portál; složení zůstává v setup_polozky (interní).';

-- ---------------------------------------------------------------------------
-- 2) Klientské účty (auth.users → klienti, ne profiles)
-- ---------------------------------------------------------------------------

create table if not exists public.client_accounts (
  account_id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  klient_id uuid null references public.klienti (klient_id) on delete restrict,
  role text not null default 'owner',
  stav text not null default 'pending',
  jmeno text null,
  prijmeni text null,
  telefon text null,
  schvalil_user_id uuid null references auth.users (id) on delete set null,
  schvaleno_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_accounts_role_check
    check (role in ('owner', 'member')),
  constraint client_accounts_stav_check
    check (stav in ('pending', 'active', 'disabled')),
  constraint client_accounts_active_requires_klient_check
    check (stav <> 'active' or klient_id is not null)
);

create index if not exists client_accounts_klient_id_idx
  on public.client_accounts (klient_id);

create index if not exists client_accounts_stav_idx
  on public.client_accounts (stav);

-- ---------------------------------------------------------------------------
-- 3) Registrace klienta (schválení před aktivací účtu)
-- ---------------------------------------------------------------------------

create table if not exists public.client_registrations (
  registration_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  navrh_ico text null,
  navrh_nazev_firmy text null,
  ares_snapshot jsonb not null default '{}'::jsonb,
  stav text not null default 'pending',
  klient_id uuid null references public.klienti (klient_id) on delete set null,
  schvalil_user_id uuid null references auth.users (id) on delete set null,
  schvaleno_at timestamptz null,
  zamitnuto_duvod text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_registrations_stav_check
    check (stav in ('pending', 'approved', 'rejected')),
  constraint client_registrations_approved_requires_klient_check
    check (stav <> 'approved' or klient_id is not null)
);

create index if not exists client_registrations_user_id_idx
  on public.client_registrations (user_id);

create index if not exists client_registrations_stav_idx
  on public.client_registrations (stav);

-- ---------------------------------------------------------------------------
-- 4) Poptávky (≠ zakázky, bez rezervace techniky)
-- ---------------------------------------------------------------------------

create table if not exists public.poptavky (
  poptavka_id uuid primary key default gen_random_uuid(),
  cislo_poptavky text not null unique,
  klient_id uuid not null references public.klienti (klient_id) on delete restrict,
  vytvoril_account_id uuid not null references public.client_accounts (account_id) on delete restrict,
  stav text not null default 'koncept',
  kontakt_jmeno text null,
  kontakt_telefon text null,
  kontakt_email text null,
  misto_id uuid null references public.mista_konani (misto_id) on delete set null,
  misto_nazev text null,
  misto_adresa text null,
  misto_poznamka text null,
  misto_lat numeric null,
  misto_lng numeric null,
  datum_od date null,
  datum_do date null,
  cas_programu_od time null,
  cas_programu_do time null,
  cas_prijezd_orientacni text null,
  vice_denni boolean not null default false,
  typ_akce text null,
  typ_akce_poznamka text null,
  stavba_datum date null,
  stavba_cas_od time null,
  stavba_cas_do time null,
  stavba_pristup_od text null,
  stavba_omezeni_vjezdu text null,
  stavba_poznamka text null,
  bourani_datum date null,
  bourani_cas_od time null,
  bourani_cas_do time null,
  bourani_misto_uvolneno_do timestamptz null,
  bourani_poznamka text null,
  interni_poznamka text null,
  schvalil_user_id uuid null references auth.users (id) on delete set null,
  schvaleno_at timestamptz null,
  zamitnuto_duvod text null,
  zakazka_id uuid null references public.zakazky (zakazka_id) on delete set null,
  odeslano_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint poptavky_stav_check
    check (stav in (
      'koncept',
      'odeslana',
      'ceka_na_schvaleni',
      'v_revizi',
      'schvalena',
      'zamitnuta',
      'prevadena_do_zakazky'
    ))
);

create index if not exists poptavky_klient_id_idx
  on public.poptavky (klient_id);

create index if not exists poptavky_stav_idx
  on public.poptavky (stav);

create index if not exists poptavky_zakazka_id_idx
  on public.poptavky (zakazka_id);

create index if not exists poptavky_odeslano_at_idx
  on public.poptavky (odeslano_at desc nulls last);

-- ---------------------------------------------------------------------------
-- 5) Vybrané setupy v poptávce (setup_id, ne skladová položka)
-- ---------------------------------------------------------------------------

create table if not exists public.poptavka_setupy (
  id uuid primary key default gen_random_uuid(),
  poptavka_id uuid not null references public.poptavky (poptavka_id) on delete cascade,
  setup_id uuid not null references public.setupy (setup_id) on delete restrict,
  mnozstvi integer not null default 1,
  poznamka_klienta text null,
  poradi integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint poptavka_setupy_mnozstvi_positive check (mnozstvi > 0),
  constraint poptavka_setupy_unique_setup unique (poptavka_id, setup_id)
);

create index if not exists poptavka_setupy_poptavka_id_idx
  on public.poptavka_setupy (poptavka_id);

create index if not exists poptavka_setupy_setup_id_idx
  on public.poptavka_setupy (setup_id);

-- ---------------------------------------------------------------------------
-- 6) Technické údaje poptávky (vychází z dotazníku + rozšíření)
-- ---------------------------------------------------------------------------

create table if not exists public.poptavka_technicke_udaje (
  poptavka_id uuid primary key references public.poptavky (poptavka_id) on delete cascade,
  prijezd_poznamka text null,
  parkovani_poznamka text null,
  elektro_pripojka text null,
  elektro_jisteni text null,
  elektro_zasuvka text null,
  elektro_vzdalenost_m numeric null,
  rozvadece_poznamka text null,
  kabelove_trasy text null,
  misto_stage text null,
  misto_foh text null,
  omezeni_hluku text null,
  casova_omezeni text null,
  dalsi_poznamky text null,
  pozadovan_vyjezd_technika boolean not null default false,
  rizika jsonb not null default '[]'::jsonb,
  odpovedi_extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7) Fotky k poptávce (+ storage bucket dle projektového vzoru)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'poptavka-fotky',
  'poptavka-fotky',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.poptavka_fotky (
  id uuid primary key default gen_random_uuid(),
  poptavka_id uuid not null references public.poptavky (poptavka_id) on delete cascade,
  storage_bucket text not null default 'poptavka-fotky',
  storage_path text not null,
  typ text not null,
  popis text null,
  poradi integer not null default 0,
  original_filename text null,
  mime_type text null,
  size_bytes integer null,
  created_at timestamptz not null default now(),
  constraint poptavka_fotky_typ_check
    check (typ in ('rozvadec', 'prijezd', 'plocha_stage', 'misto_akce', 'jina'))
);

create index if not exists poptavka_fotky_poptavka_id_idx
  on public.poptavka_fotky (poptavka_id);

-- ---------------------------------------------------------------------------
-- 8) Vazba zakázka ← poptávka (po konverzi v budoucí fázi)
-- ---------------------------------------------------------------------------

alter table public.zakazky
  add column if not exists zdroj_poptavka_id uuid null references public.poptavky (poptavka_id) on delete set null;

create unique index if not exists zakazky_zdroj_poptavka_id_unique_idx
  on public.zakazky (zdroj_poptavka_id)
  where zdroj_poptavka_id is not null;

-- ---------------------------------------------------------------------------
-- 9) Helper funkce pro klientský portál / RLS
-- ---------------------------------------------------------------------------

create or replace function public.current_client_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ca.account_id
  from public.client_accounts ca
  where ca.user_id = auth.uid()
    and ca.stav = 'active'
    and ca.klient_id is not null
  limit 1;
$$;

create or replace function public.current_client_klient_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ca.klient_id
  from public.client_accounts ca
  where ca.user_id = auth.uid()
    and ca.stav = 'active'
    and ca.klient_id is not null
  limit 1;
$$;

create or replace function public.is_client_portal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_client_account_id() is not null;
$$;

create or replace function public.client_can_access_poptavka(p_poptavka_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.poptavky p
    where p.poptavka_id = p_poptavka_id
      and p.klient_id = public.current_client_klient_id()
  );
$$;

create or replace function public.client_can_edit_poptavka(p_poptavka_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.poptavky p
    where p.poptavka_id = p_poptavka_id
      and p.klient_id = public.current_client_klient_id()
      and p.stav in ('koncept', 'v_revizi')
  );
$$;

create or replace function public.is_portal_setup(p_setup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.setupy s
    where s.setup_id = p_setup_id
      and s.aktivni = true
      and s.dostupne_v_portalu = true
  );
$$;

grant execute on function public.current_client_account_id() to authenticated;
grant execute on function public.current_client_klient_id() to authenticated;
grant execute on function public.is_client_portal_user() to authenticated;
grant execute on function public.client_can_access_poptavka(uuid) to authenticated;
grant execute on function public.client_can_edit_poptavka(uuid) to authenticated;
grant execute on function public.is_portal_setup(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) RLS
-- ---------------------------------------------------------------------------

alter table public.client_accounts enable row level security;
alter table public.client_registrations enable row level security;
alter table public.poptavky enable row level security;
alter table public.poptavka_setupy enable row level security;
alter table public.poptavka_technicke_udaje enable row level security;
alter table public.poptavka_fotky enable row level security;

-- client_accounts
drop policy if exists "Klient ctou svuj ucet" on public.client_accounts;
create policy "Klient ctou svuj ucet"
on public.client_accounts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Interni ctou client accounts" on public.client_accounts;
create policy "Interni ctou client accounts"
on public.client_accounts
for select
to authenticated
using (public.is_active_internal_reader());

drop policy if exists "Interni spravuji client accounts" on public.client_accounts;
create policy "Interni zapisuji client accounts"
on public.client_accounts
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

create policy "Interni upravuji client accounts"
on public.client_accounts
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

create policy "Interni mazaji client accounts"
on public.client_accounts
for delete
to authenticated
using (public.is_operational_write_user());

-- client_registrations
drop policy if exists "Klient ctou svou registraci" on public.client_registrations;
create policy "Klient ctou svou registraci"
on public.client_registrations
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Klient vklada registraci" on public.client_registrations;
create policy "Klient vklada registraci"
on public.client_registrations
for insert
to authenticated
with check (
  user_id = auth.uid()
  and stav = 'pending'
  and not public.is_active_internal_reader()
);

drop policy if exists "Interni ctou client registrations" on public.client_registrations;
create policy "Interni ctou client registrations"
on public.client_registrations
for select
to authenticated
using (public.is_active_internal_reader());

drop policy if exists "Interni spravuji client registrations" on public.client_registrations;
create policy "Interni upravuji client registrations"
on public.client_registrations
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

-- setupy: klientský SELECT pouze aktivní + dostupné v portálu (bez setup_polozky)
drop policy if exists "Klient ctou setupy dostupne v portale" on public.setupy;
create policy "Klient ctou setupy dostupne v portale"
on public.setupy
for select
to authenticated
using (
  public.is_client_portal_user()
  and aktivni = true
  and dostupne_v_portalu = true
);

-- setup_polozky: beze změny — pouze interní (existující policy), klient nemá SELECT

-- poptavky
drop policy if exists "Klient ctou sve poptavky" on public.poptavky;
create policy "Klient ctou sve poptavky"
on public.poptavky
for select
to authenticated
using (
  public.is_client_portal_user()
  and klient_id = public.current_client_klient_id()
);

drop policy if exists "Klient vklada poptavku" on public.poptavky;
create policy "Klient vklada poptavku"
on public.poptavky
for insert
to authenticated
with check (
  public.is_client_portal_user()
  and klient_id = public.current_client_klient_id()
  and vytvoril_account_id = public.current_client_account_id()
  and stav = 'koncept'
);

drop policy if exists "Klient upravuje svou poptavku" on public.poptavky;
create policy "Klient upravuje svou poptavku"
on public.poptavky
for update
to authenticated
using (
  public.is_client_portal_user()
  and klient_id = public.current_client_klient_id()
  and stav in ('koncept', 'v_revizi')
)
with check (
  klient_id = public.current_client_klient_id()
  and stav in ('koncept', 'odeslana', 'v_revizi')
);

drop policy if exists "Interni ctou poptavky" on public.poptavky;
create policy "Interni ctou poptavky"
on public.poptavky
for select
to authenticated
using (public.is_active_internal_reader());

drop policy if exists "Interni zapisuji poptavky" on public.poptavky;
create policy "Interni zapisuji poptavky"
on public.poptavky
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

create policy "Interni upravuji poptavky"
on public.poptavky
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

create policy "Interni mazaji poptavky"
on public.poptavky
for delete
to authenticated
using (public.is_operational_write_user());

-- poptavka_setupy
drop policy if exists "Klient ctou sve poptavka setupy" on public.poptavka_setupy;
create policy "Klient ctou sve poptavka setupy"
on public.poptavka_setupy
for select
to authenticated
using (public.client_can_access_poptavka(poptavka_id));

drop policy if exists "Klient spravuje sve poptavka setupy" on public.poptavka_setupy;
create policy "Klient vklada poptavka setupy"
on public.poptavka_setupy
for insert
to authenticated
with check (
  public.client_can_edit_poptavka(poptavka_id)
  and public.is_portal_setup(setup_id)
);

create policy "Klient upravuje poptavka setupy"
on public.poptavka_setupy
for update
to authenticated
using (public.client_can_edit_poptavka(poptavka_id))
with check (
  public.client_can_edit_poptavka(poptavka_id)
  and public.is_portal_setup(setup_id)
);

create policy "Klient maze poptavka setupy"
on public.poptavka_setupy
for delete
to authenticated
using (public.client_can_edit_poptavka(poptavka_id));

drop policy if exists "Interni ctou poptavka setupy" on public.poptavka_setupy;
create policy "Interni ctou poptavka setupy"
on public.poptavka_setupy
for select
to authenticated
using (public.is_active_internal_reader());

create policy "Interni zapisuji poptavka setupy"
on public.poptavka_setupy
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

create policy "Interni upravuji poptavka setupy"
on public.poptavka_setupy
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

create policy "Interni mazaji poptavka setupy"
on public.poptavka_setupy
for delete
to authenticated
using (public.is_internal_write_excluding_hdt());

-- poptavka_technicke_udaje
drop policy if exists "Klient ctou technicke udaje poptavky" on public.poptavka_technicke_udaje;
create policy "Klient ctou technicke udaje poptavky"
on public.poptavka_technicke_udaje
for select
to authenticated
using (public.client_can_access_poptavka(poptavka_id));

drop policy if exists "Klient spravuje technicke udaje poptavky" on public.poptavka_technicke_udaje;
create policy "Klient vklada technicke udaje poptavky"
on public.poptavka_technicke_udaje
for insert
to authenticated
with check (public.client_can_edit_poptavka(poptavka_id));

create policy "Klient upravuje technicke udaje poptavky"
on public.poptavka_technicke_udaje
for update
to authenticated
using (public.client_can_edit_poptavka(poptavka_id))
with check (public.client_can_edit_poptavka(poptavka_id));

drop policy if exists "Interni ctou technicke udaje poptavky" on public.poptavka_technicke_udaje;
create policy "Interni ctou technicke udaje poptavky"
on public.poptavka_technicke_udaje
for select
to authenticated
using (public.is_active_internal_reader());

create policy "Interni zapisuji technicke udaje poptavky"
on public.poptavka_technicke_udaje
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

create policy "Interni upravuji technicke udaje poptavky"
on public.poptavka_technicke_udaje
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

create policy "Interni mazaji technicke udaje poptavky"
on public.poptavka_technicke_udaje
for delete
to authenticated
using (public.is_internal_write_excluding_hdt());

-- poptavka_fotky
drop policy if exists "Klient ctou fotky poptavky" on public.poptavka_fotky;
create policy "Klient ctou fotky poptavky"
on public.poptavka_fotky
for select
to authenticated
using (public.client_can_access_poptavka(poptavka_id));

drop policy if exists "Klient spravuje fotky poptavky" on public.poptavka_fotky;
create policy "Klient vklada fotky poptavky"
on public.poptavka_fotky
for insert
to authenticated
with check (public.client_can_edit_poptavka(poptavka_id));

create policy "Klient upravuje fotky poptavky"
on public.poptavka_fotky
for update
to authenticated
using (public.client_can_edit_poptavka(poptavka_id))
with check (public.client_can_edit_poptavka(poptavka_id));

create policy "Klient maze fotky poptavky"
on public.poptavka_fotky
for delete
to authenticated
using (public.client_can_edit_poptavka(poptavka_id));

drop policy if exists "Interni ctou fotky poptavky" on public.poptavka_fotky;
create policy "Interni ctou fotky poptavky"
on public.poptavka_fotky
for select
to authenticated
using (public.is_active_internal_reader());

create policy "Interni zapisuji fotky poptavky"
on public.poptavka_fotky
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

create policy "Interni upravuji fotky poptavky"
on public.poptavka_fotky
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

create policy "Interni mazaji fotky poptavky"
on public.poptavka_fotky
for delete
to authenticated
using (public.is_internal_write_excluding_hdt());

-- Klient může číst vlastní firmu (profil / fakturační kontext v portálu)
drop policy if exists "Klient ctou svou firmu" on public.klienti;
create policy "Klient ctou svou firmu"
on public.klienti
for select
to authenticated
using (
  public.is_client_portal_user()
  and klient_id = public.current_client_klient_id()
);
