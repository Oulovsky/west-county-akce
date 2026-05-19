-- Baseline pro čistou produkční / lokální databázi: základní tabulky, na které navazují
-- pozdější migrace (dříve existovaly jen mimo repozitář).

create extension if not exists pgcrypto;

-- Profily interních uživatelů (navazuje na Supabase Auth)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text null,
  role text not null default 'zamestnanec',
  jmeno text null,
  prijmeni text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- Klienti a místa konání (162016 migrace stejné tabulky vytváří znovu přes IF NOT EXISTS)
create table if not exists public.klienti (
  klient_id uuid primary key default gen_random_uuid(),
  nazev text not null,
  aktivni boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mista_konani (
  misto_id uuid primary key default gen_random_uuid(),
  klient_id uuid null references public.klienti (klient_id),
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

-- Zakázky: jádrové sloupce (rozšíření přidávají pozdější migrace přes ADD COLUMN IF NOT EXISTS)
create table if not exists public.zakazky (
  zakazka_id uuid primary key default gen_random_uuid(),
  cislo_zakazky text not null,
  stav_zakazky_id uuid not null,
  nazev text not null,
  misto text null,
  typ_obsluhy text null,
  odjezd_ze_skladu timestamptz null,
  sraz_na_miste timestamptz null,
  stavba_od timestamptz null,
  stavba_do timestamptz null,
  akce_od timestamptz null,
  akce_do timestamptz null,
  bourani_od timestamptz null,
  bourani_do timestamptz null,
  datum_od date not null,
  datum_do date not null,
  cas_od time null,
  cas_do time null,
  stage_preset text null,
  stage_width_m numeric null,
  stage_depth_m numeric null,
  sound_preset text null,
  lights_preset text null,
  led_kind text null,
  led_width_m numeric null,
  led_height_m numeric null,
  led_requested_area_m2 numeric null,
  led_wall_rohy boolean null default false,
  led_is_mantel boolean null default false,
  kamery_count integer null default 0,
  dron boolean null default false,
  poznamka text null,
  zrusena boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zakazky_datum_od_idx on public.zakazky (datum_od);

-- Skladové položky a kusy
create table if not exists public.skladove_polozky (
  skladova_polozka_id uuid primary key default gen_random_uuid(),
  nazev text not null,
  pozice integer null,
  sklad_blok_id uuid null,
  kategorie_techniky_id uuid null,
  podkategorie_techniky_id uuid null,
  jednotka_id uuid null,
  interni_naklad numeric null,
  fakturacni_cena numeric null,
  aktivni boolean not null default true,
  poznamka text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sklad_polozky_kusy (
  kus_id uuid primary key default gen_random_uuid(),
  skladova_polozka_id uuid not null references public.skladove_polozky (skladova_polozka_id) on delete cascade,
  poradove_cislo integer not null,
  evidencni_cislo text null,
  stav text not null default 'skladem',
  poznamka text null,
  aktivni boolean not null default true,
  created_at timestamptz not null default now(),
  constraint sklad_polozky_kusy_stav_check check (
    stav in (
      'skladem',
      'na_akci',
      'na_zakazce',
      'poskozeno',
      'blokovano'
    )
  )
);

create index if not exists sklad_polozky_kusy_skladova_polozka_idx
  on public.sklad_polozky_kusy (skladova_polozka_id);

-- Plán techniky a realizace (RPC create_zakazka_atomic a aplikace)
create table if not exists public.zakazka_realizace (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky (zakazka_id) on delete cascade,
  nazev text not null default '',
  poradi integer not null default 0,
  stage_typ text null,
  stage_sirka numeric null,
  stage_hloubka numeric null,
  sound_typ text null,
  lights_typ text null,
  led_typ text null,
  led_sirka numeric null,
  led_vyska numeric null,
  led_rohy boolean null,
  kamery integer null,
  dron boolean null,
  created_at timestamptz not null default now()
);

create index if not exists zakazka_realizace_zakazka_idx on public.zakazka_realizace (zakazka_id, poradi);

create table if not exists public.technika_na_zakazce (
  zakazka_id uuid not null references public.zakazky (zakazka_id) on delete cascade,
  skladova_polozka_id uuid not null references public.skladove_polozky (skladova_polozka_id) on delete cascade,
  mnozstvi integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (zakazka_id, skladova_polozka_id)
);

-- Přiřazení lidí k zakázce
create table if not exists public.zakazka_lide (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky (zakazka_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  datum_od timestamptz null,
  datum_do timestamptz null,
  typ_bloku text not null default 'akce',
  poznamka text null,
  role_na_zakazce text null default 'technik',
  created_at timestamptz not null default now()
);

create index if not exists zakazka_lide_zakazka_idx on public.zakazka_lide (zakazka_id);
create index if not exists zakazka_lide_user_idx on public.zakazka_lide (user_id);
