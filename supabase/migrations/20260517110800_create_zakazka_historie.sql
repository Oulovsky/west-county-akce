create extension if not exists pgcrypto;

create table if not exists public.zakazka_historie (
  historie_id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky(zakazka_id) on delete cascade,
  event_type text not null,
  actor_id uuid null,
  title text not null,
  detail text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists zakazka_historie_zakazka_created_idx
  on public.zakazka_historie (zakazka_id, created_at desc);

create index if not exists zakazka_historie_actor_idx
  on public.zakazka_historie (actor_id);

alter table public.zakazka_historie enable row level security;

drop policy if exists "Interni uzivatele ctou historii zakazky" on public.zakazka_historie;
drop policy if exists "Interni uzivatele zapisujou historii zakazky" on public.zakazka_historie;

create policy "Interni uzivatele ctou historii zakazky"
on public.zakazka_historie
for select
to authenticated
using (true);

create policy "Interni uzivatele zapisujou historii zakazky"
on public.zakazka_historie
for insert
to authenticated
with check (auth.uid() = actor_id or actor_id is null);
