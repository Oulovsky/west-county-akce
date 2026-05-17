create extension if not exists pgcrypto;

alter table public.zakazky
  add column if not exists client_approval_status text not null default 'draft',
  add column if not exists client_approval_approved_at timestamptz null,
  add column if not exists client_approval_declined_at timestamptz null,
  add column if not exists client_approval_declined_reason text null;

alter table public.zakazky
  drop constraint if exists zakazky_client_approval_status_check;

alter table public.zakazky
  add constraint zakazky_client_approval_status_check
  check (
    client_approval_status in (
      'draft',
      'questionnaire_sent',
      'technical_info_received',
      'sent_for_approval',
      'approved',
      'declined'
    )
  );

create table if not exists public.zakazka_approval_links (
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
  open_count integer not null default 0,
  approved_at timestamptz null,
  declined_at timestamptz null,
  declined_reason text null
);

create index if not exists zakazka_approval_links_zakazka_created_idx
  on public.zakazka_approval_links (zakazka_id, created_at desc);

create index if not exists zakazka_approval_links_active_idx
  on public.zakazka_approval_links (zakazka_id)
  where revoked_at is null;

alter table public.zakazka_approval_links enable row level security;

drop policy if exists "Interni uzivatele ctou schvaleni zakazky" on public.zakazka_approval_links;
drop policy if exists "Interni uzivatele spravuji schvaleni zakazky" on public.zakazka_approval_links;

create policy "Interni uzivatele ctou schvaleni zakazky"
on public.zakazka_approval_links
for select
to authenticated
using (true);

create policy "Interni uzivatele spravuji schvaleni zakazky"
on public.zakazka_approval_links
for all
to authenticated
using (true)
with check (true);
