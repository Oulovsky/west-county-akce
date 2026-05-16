create table if not exists public.zakazka_client_links (
  link_id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky(zakazka_id) on delete cascade,
  klient_id uuid null references public.klienti(klient_id) on delete set null,
  token_hash text unique not null,
  email_to text null,
  stav text not null default 'vytvoren',
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  email_sent_at timestamptz null,
  opened_at timestamptz null,
  last_opened_at timestamptz null,
  open_count integer not null default 0
);

create table if not exists public.zakazka_dotazniky (
  dotaznik_id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky(zakazka_id) on delete cascade,
  link_id uuid null references public.zakazka_client_links(link_id) on delete set null,
  stav text not null default 'rozpracovano',
  kontakt_jmeno text null,
  kontakt_telefon text null,
  prijezd_poznamka text null,
  parkovani_poznamka text null,
  elektro_pripojka text null,
  elektro_jisteni text null,
  elektro_zasuvka text null,
  elektro_vzdalenost_m numeric null,
  pozadovan_vyjezd_technika boolean not null default false,
  potvrzeni_pravdivosti boolean not null default false,
  potvrzeni_doctovani boolean not null default false,
  rizika jsonb not null default '[]'::jsonb,
  odpovedi_extra jsonb not null default '{}'::jsonb,
  submitted_at timestamptz null,
  ip_hash text null,
  user_agent text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.misto_technicke_poznamky (
  poznamka_id uuid primary key default gen_random_uuid(),
  misto_id uuid not null references public.mista_konani(misto_id) on delete cascade,
  zakazka_id uuid null references public.zakazky(zakazka_id) on delete set null,
  klient_id uuid null references public.klienti(klient_id) on delete set null,
  typ text not null,
  text text not null,
  overeno boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists zakazka_client_links_zakazka_id_idx
  on public.zakazka_client_links (zakazka_id);

create index if not exists zakazka_dotazniky_zakazka_id_idx
  on public.zakazka_dotazniky (zakazka_id);

create index if not exists misto_technicke_poznamky_misto_id_idx
  on public.misto_technicke_poznamky (misto_id);
