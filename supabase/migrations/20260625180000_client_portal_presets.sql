-- Klientské presety mimo poptávku + mazání konceptů

create table if not exists public.client_place_presets (
  preset_id uuid primary key default gen_random_uuid(),
  klient_id uuid not null references public.klienti (klient_id) on delete cascade,
  account_id uuid null references public.client_accounts (account_id) on delete set null,
  nazev text not null,
  adresa_text text null,
  lat double precision null,
  lng double precision null,
  presny_popis_mista text null,
  poznamka_prijezd text null,
  omezeni_vjezdu text null,
  poznamka_manipulace text null,
  interni_poznamka_klienta text null,
  source_poptavka_id uuid null references public.poptavky (poptavka_id) on delete set null,
  source_misto_id uuid null references public.mista_konani (misto_id) on delete set null,
  aktivni boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_place_presets_nazev_check check (char_length(trim(nazev)) > 0)
);

create index if not exists client_place_presets_klient_idx
  on public.client_place_presets (klient_id, aktivni, updated_at desc);

create table if not exists public.client_technical_presets (
  preset_id uuid primary key default gen_random_uuid(),
  klient_id uuid not null references public.klienti (klient_id) on delete cascade,
  account_id uuid null references public.client_accounts (account_id) on delete set null,
  nazev text not null,
  technicke_data jsonb not null default '{}'::jsonb,
  source_poptavka_id uuid null references public.poptavky (poptavka_id) on delete set null,
  source_misto_id uuid null references public.mista_konani (misto_id) on delete set null,
  aktivni boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_technical_presets_nazev_check check (char_length(trim(nazev)) > 0)
);

create index if not exists client_technical_presets_klient_idx
  on public.client_technical_presets (klient_id, aktivni, updated_at desc);

create table if not exists public.client_setup_presets (
  preset_id uuid primary key default gen_random_uuid(),
  klient_id uuid not null references public.klienti (klient_id) on delete cascade,
  account_id uuid null references public.client_accounts (account_id) on delete set null,
  nazev text not null,
  sestava_konfigurator jsonb not null default '{}'::jsonb,
  setupy jsonb not null default '[]'::jsonb,
  popis text null,
  source_poptavka_id uuid null references public.poptavky (poptavka_id) on delete set null,
  source_misto_id uuid null references public.mista_konani (misto_id) on delete set null,
  aktivni boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_setup_presets_nazev_check check (char_length(trim(nazev)) > 0)
);

create index if not exists client_setup_presets_klient_idx
  on public.client_setup_presets (klient_id, aktivni, updated_at desc);

-- Klient smí smazat jen vlastní koncept
create or replace function public.client_can_delete_poptavka(p_poptavka_id uuid)
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
      and p.stav = 'koncept'
  );
$$;

grant execute on function public.client_can_delete_poptavka(uuid) to authenticated;

drop policy if exists "Klient maze svuj koncept poptavky" on public.poptavky;
create policy "Klient maze svuj koncept poptavky"
on public.poptavky
for delete
to authenticated
using (public.client_can_delete_poptavka(poptavka_id));

-- RLS presety
alter table public.client_place_presets enable row level security;
alter table public.client_technical_presets enable row level security;
alter table public.client_setup_presets enable row level security;

drop policy if exists "Klient ctou sve place presety" on public.client_place_presets;
create policy "Klient ctou sve place presety"
on public.client_place_presets for select to authenticated
using (klient_id = public.current_client_klient_id());

drop policy if exists "Klient spravuje sve place presety" on public.client_place_presets;
create policy "Klient vklada place presety"
on public.client_place_presets for insert to authenticated
with check (klient_id = public.current_client_klient_id());

create policy "Klient upravuje place presety"
on public.client_place_presets for update to authenticated
using (klient_id = public.current_client_klient_id())
with check (klient_id = public.current_client_klient_id());

create policy "Klient maze place presety"
on public.client_place_presets for delete to authenticated
using (klient_id = public.current_client_klient_id());

drop policy if exists "Klient ctou sve technical presety" on public.client_technical_presets;
create policy "Klient ctou sve technical presety"
on public.client_technical_presets for select to authenticated
using (klient_id = public.current_client_klient_id());

drop policy if exists "Klient spravuje sve technical presety" on public.client_technical_presets;
create policy "Klient vklada technical presety"
on public.client_technical_presets for insert to authenticated
with check (klient_id = public.current_client_klient_id());

create policy "Klient upravuje technical presety"
on public.client_technical_presets for update to authenticated
using (klient_id = public.current_client_klient_id())
with check (klient_id = public.current_client_klient_id());

create policy "Klient maze technical presety"
on public.client_technical_presets for delete to authenticated
using (klient_id = public.current_client_klient_id());

drop policy if exists "Klient ctou sve setup presety" on public.client_setup_presets;
create policy "Klient ctou sve setup presety"
on public.client_setup_presets for select to authenticated
using (klient_id = public.current_client_klient_id());

drop policy if exists "Klient spravuje sve setup presety" on public.client_setup_presets;
create policy "Klient vklada setup presety"
on public.client_setup_presets for insert to authenticated
with check (klient_id = public.current_client_klient_id());

create policy "Klient upravuje setup presety"
on public.client_setup_presets for update to authenticated
using (klient_id = public.current_client_klient_id())
with check (klient_id = public.current_client_klient_id());

create policy "Klient maze setup presety"
on public.client_setup_presets for delete to authenticated
using (klient_id = public.current_client_klient_id());
