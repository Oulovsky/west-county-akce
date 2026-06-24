-- Závazná objednávka poptávky: nové stavy, denormalizované sloupce a tabulka odkazů.
-- Zatím pouze DB základ — UI, akce a token workflow přijdou později.

-- ---------------------------------------------------------------------------
-- 1) Rozšíření stavů poptávky
-- ---------------------------------------------------------------------------

alter table public.poptavky
  drop constraint if exists poptavky_stav_check;

alter table public.poptavky
  add constraint poptavky_stav_check
  check (
    stav in (
      'koncept',
      'odeslana',
      'ceka_na_schvaleni',
      'v_revizi',
      'schvalena',
      'zamitnuta',
      'prevadena_do_zakazky',
      'objednavka_odeslana',
      'objednavka_potvrzena',
      'objednavka_odmitnuta'
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Denormalizované sloupce na poptavky
-- ---------------------------------------------------------------------------

alter table public.poptavky
  add column if not exists objednavka_odeslana_at timestamptz null,
  add column if not exists objednavka_odeslana_user_id uuid null references public.profiles (user_id) on delete set null,
  add column if not exists objednavka_potvrzena_at timestamptz null,
  add column if not exists objednavka_potvrzena_zpusob text null,
  add column if not exists objednavka_odmitnuta_at timestamptz null,
  add column if not exists objednavka_odmitnuta_duvod text null;

alter table public.poptavky
  drop constraint if exists poptavky_objednavka_potvrzena_zpusob_check;

alter table public.poptavky
  add constraint poptavky_objednavka_potvrzena_zpusob_check
  check (
    objednavka_potvrzena_zpusob is null
    or objednavka_potvrzena_zpusob in ('token', 'portal')
  );

create index if not exists poptavky_objednavka_odeslana_at_idx
  on public.poptavky (objednavka_odeslana_at desc nulls last);

create index if not exists poptavky_objednavka_potvrzena_at_idx
  on public.poptavky (objednavka_potvrzena_at desc nulls last);

comment on column public.poptavky.objednavka_odeslana_at is
  'Kdy interní tým odeslal klientovi závaznou objednávku poptávky.';
comment on column public.poptavky.objednavka_odeslana_user_id is
  'Interní uživatel (profiles), který závaznou objednávku odeslal.';
comment on column public.poptavky.objednavka_potvrzena_at is
  'Kdy klient potvrdil závaznou objednávku.';
comment on column public.poptavky.objednavka_potvrzena_zpusob is
  'Zpusob potvrzeni: token (verejny odkaz) nebo portal (prihlaseny klient).';
comment on column public.poptavky.objednavka_odmitnuta_at is
  'Kdy klient odmitl závaznou objednávku.';
comment on column public.poptavky.objednavka_odmitnuta_duvod is
  'Duvod odmitnuti závazné objednávky od klienta.';

-- ---------------------------------------------------------------------------
-- 3) Tabulka odkazů pro závaznou objednávku
-- ---------------------------------------------------------------------------

create table if not exists public.poptavka_objednavka_links (
  link_id uuid primary key default gen_random_uuid(),
  poptavka_id uuid not null references public.poptavky (poptavka_id) on delete cascade,
  klient_id uuid null references public.klienti (klient_id) on delete set null,
  token_hash text not null,
  email_to text null,
  stav text not null default 'vytvoren',
  objednavka_snapshot jsonb not null default '{}'::jsonb,
  objednavka_snapshot_created_at timestamptz null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  email_sent_at timestamptz null,
  opened_at timestamptz null,
  last_opened_at timestamptz null,
  open_count integer not null default 0,
  potvrzeno_at timestamptz null,
  potvrzeno_ip text null,
  potvrzeno_user_agent text null,
  potvrzeno_account_id uuid null references public.client_accounts (account_id) on delete set null,
  odmitnuto_at timestamptz null,
  odmitnuto_duvod text null,
  constraint poptavka_objednavka_links_token_hash_key unique (token_hash),
  constraint poptavka_objednavka_links_stav_check
    check (
      stav in (
        'vytvoren',
        'email_odeslan',
        'potvrzeno',
        'odmitnuto',
        'revoked',
        'email_error'
      )
    ),
  constraint poptavka_objednavka_links_open_count_nonnegative_check
    check (open_count >= 0)
);

create index if not exists poptavka_objednavka_links_poptavka_created_idx
  on public.poptavka_objednavka_links (poptavka_id, created_at desc);

create index if not exists poptavka_objednavka_links_token_hash_idx
  on public.poptavka_objednavka_links (token_hash);

create index if not exists poptavka_objednavka_links_active_idx
  on public.poptavka_objednavka_links (poptavka_id)
  where revoked_at is null;

create unique index if not exists poptavka_objednavka_links_one_pending_idx
  on public.poptavka_objednavka_links (poptavka_id)
  where revoked_at is null
    and potvrzeno_at is null
    and odmitnuto_at is null;

comment on table public.poptavka_objednavka_links is
  'Tokenove odkazy pro potvrzeni závazné objednávky poptávky klientem.';
comment on column public.poptavka_objednavka_links.objednavka_snapshot is
  'Zmrazeny snapshot obsahu objednavky v okamziku odeslani klientovi.';

-- ---------------------------------------------------------------------------
-- 4) RLS — vzor jako zakazka_approval_links (interni read/write, bez klienta)
-- ---------------------------------------------------------------------------

alter table public.poptavka_objednavka_links enable row level security;

drop policy if exists "Interni ctou objednavku poptavky" on public.poptavka_objednavka_links;
create policy "Interni ctou objednavku poptavky"
on public.poptavka_objednavka_links
for select
to authenticated
using (public.is_active_internal_reader());

drop policy if exists "Interni vkladaji objednavku poptavky" on public.poptavka_objednavka_links;
create policy "Interni vkladaji objednavku poptavky"
on public.poptavka_objednavka_links
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

drop policy if exists "Interni upravuji objednavku poptavky" on public.poptavka_objednavka_links;
create policy "Interni upravuji objednavku poptavky"
on public.poptavka_objednavka_links
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

drop policy if exists "Interni mazaji objednavku poptavky" on public.poptavka_objednavka_links;
create policy "Interni mazaji objednavku poptavky"
on public.poptavka_objednavka_links
for delete
to authenticated
using (public.is_internal_write_excluding_hdt());
