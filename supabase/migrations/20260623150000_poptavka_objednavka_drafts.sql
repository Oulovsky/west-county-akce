-- Editovatelný draft závazné objednávky poptávky.
-- Draft = rozpracovaný dokument; odeslaná verze zůstává v poptavka_objednavka_links.objednavka_snapshot.

-- ---------------------------------------------------------------------------
-- 1) Tabulka draftů
-- ---------------------------------------------------------------------------

create table if not exists public.poptavka_objednavka_drafts (
  draft_id uuid primary key default gen_random_uuid(),
  poptavka_id uuid not null references public.poptavky (poptavka_id) on delete cascade,
  stav text not null default 'rozpracovano',
  draft_data jsonb not null default '{}'::jsonb,
  draft_schema_version integer not null default 1,
  fakturacni_firma_id uuid null references public.fakturacni_firmy (id) on delete set null,
  based_on_poptavka_updated_at timestamptz null,
  prepared_by_user_id uuid null references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint poptavka_objednavka_drafts_stav_check
    check (
      stav in (
        'rozpracovano',
        'pripraveno_k_odeslani',
        'odeslano',
        'archivovano'
      )
    ),
  constraint poptavka_objednavka_drafts_draft_schema_version_positive_check
    check (draft_schema_version >= 1)
);

-- Jeden aktivní draft na poptávku; odeslané/archivované verze mohou zůstat v historii.
create unique index if not exists poptavka_objednavka_drafts_one_active_idx
  on public.poptavka_objednavka_drafts (poptavka_id)
  where stav in ('rozpracovano', 'pripraveno_k_odeslani');

create index if not exists poptavka_objednavka_drafts_poptavka_id_idx
  on public.poptavka_objednavka_drafts (poptavka_id);

create index if not exists poptavka_objednavka_drafts_fakturacni_firma_id_idx
  on public.poptavka_objednavka_drafts (fakturacni_firma_id);

create index if not exists poptavka_objednavka_drafts_prepared_by_user_id_idx
  on public.poptavka_objednavka_drafts (prepared_by_user_id);

create index if not exists poptavka_objednavka_drafts_updated_at_idx
  on public.poptavka_objednavka_drafts (updated_at desc);

comment on table public.poptavka_objednavka_drafts is
  'Rozpracovaný editovatelný návrh závazné objednávky poptávky před odesláním klientovi.';
comment on column public.poptavka_objednavka_drafts.draft_data is
  'Strukturovaný obsah návrhu objednávky; při odeslání se zmrazí do poptavka_objednavka_links.objednavka_snapshot.';
comment on column public.poptavka_objednavka_drafts.based_on_poptavka_updated_at is
  'poptavky.updated_at v okamžiku posledního předvyplnění draftu z poptávky (varování při změně zdroje).';

-- ---------------------------------------------------------------------------
-- 2) updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_poptavka_objednavka_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_poptavka_objednavka_drafts_updated_at
  on public.poptavka_objednavka_drafts;

create trigger set_poptavka_objednavka_drafts_updated_at
before update on public.poptavka_objednavka_drafts
for each row
execute function public.set_poptavka_objednavka_drafts_updated_at();

-- ---------------------------------------------------------------------------
-- 3) RLS — interní read/write, bez klientského přístupu
-- ---------------------------------------------------------------------------

alter table public.poptavka_objednavka_drafts enable row level security;

drop policy if exists "Interni ctou draft objednavky poptavky" on public.poptavka_objednavka_drafts;
create policy "Interni ctou draft objednavky poptavky"
on public.poptavka_objednavka_drafts
for select
to authenticated
using (public.is_active_internal_reader());

drop policy if exists "Interni vkladaji draft objednavky poptavky" on public.poptavka_objednavka_drafts;
create policy "Interni vkladaji draft objednavky poptavky"
on public.poptavka_objednavka_drafts
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

drop policy if exists "Interni upravuji draft objednavky poptavky" on public.poptavka_objednavka_drafts;
create policy "Interni upravuji draft objednavky poptavky"
on public.poptavka_objednavka_drafts
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

drop policy if exists "Interni mazaji draft objednavky poptavky" on public.poptavka_objednavka_drafts;
create policy "Interni mazaji draft objednavky poptavky"
on public.poptavka_objednavka_drafts
for delete
to authenticated
using (public.is_internal_write_excluding_hdt());

-- ---------------------------------------------------------------------------
-- 4) Traceabilita: který draft se zmrazil do odeslaného linku
-- ---------------------------------------------------------------------------

alter table public.poptavka_objednavka_links
  add column if not exists draft_id uuid null references public.poptavka_objednavka_drafts (draft_id) on delete set null,
  add column if not exists snapshot_schema_version integer not null default 1;

alter table public.poptavka_objednavka_links
  drop constraint if exists poptavka_objednavka_links_snapshot_schema_version_positive_check;

alter table public.poptavka_objednavka_links
  add constraint poptavka_objednavka_links_snapshot_schema_version_positive_check
  check (snapshot_schema_version >= 1);

create index if not exists poptavka_objednavka_links_draft_id_idx
  on public.poptavka_objednavka_links (draft_id);

comment on column public.poptavka_objednavka_links.draft_id is
  'Draft, ze kterého vznikl tento odeslaný snapshot (pokud existoval).';
comment on column public.poptavka_objednavka_links.snapshot_schema_version is
  'Verze schématu objednavka_snapshot zmrazeného při odeslání.';
