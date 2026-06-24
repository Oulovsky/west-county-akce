-- Editovatelný katalog pro klientský konfigurátor sestavy (LED, zastřešení, presety).
-- Výchozí obsah odpovídá DEFAULT_PORTAL_SESTAVA_KATALOG v aplikaci; lze upravit bez deploye.

create table if not exists public.portal_konfigurator_katalog (
  katalog_id uuid primary key default gen_random_uuid(),
  kod text not null unique,
  verze integer not null default 1,
  obsah jsonb not null,
  aktivni boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.portal_konfigurator_katalog is
  'Editovatelný JSON katalog pro klientský konfigurátor stage/LED/pódium.';

alter table public.portal_konfigurator_katalog enable row level security;

-- Interní správa; portál načítá přes service role (admin client).
create policy portal_konfigurator_katalog_service_all
  on public.portal_konfigurator_katalog
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant select, insert, update, delete on public.portal_konfigurator_katalog to service_role;
