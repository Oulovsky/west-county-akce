create table if not exists public.notifikace (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  typ text not null,
  priorita text not null,
  titulek text not null,
  zprava text not null,
  related_zakazka_id uuid null references public.zakazky(zakazka_id) on delete set null,
  related_kus_id uuid null,
  related_faktura_id uuid null,
  akce_url text null,
  dedupe_key text null,
  read_at timestamptz null,
  dismissed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint notifikace_priorita_check check (priorita in ('info', 'warning', 'critical'))
);

create unique index if not exists notifikace_dedupe_key_idx
  on public.notifikace (dedupe_key)
  where dedupe_key is not null;

create index if not exists notifikace_user_unread_idx
  on public.notifikace (user_id, created_at desc)
  where read_at is null and dismissed_at is null;

create index if not exists notifikace_related_zakazka_idx
  on public.notifikace (related_zakazka_id, created_at desc);

alter table public.notifikace enable row level security;

drop policy if exists "Uzivatel cte svoje notifikace" on public.notifikace;
drop policy if exists "Uzivatel upravuje svoje notifikace" on public.notifikace;
drop policy if exists "Interni system zapisuje notifikace" on public.notifikace;

create policy "Uzivatel cte svoje notifikace"
on public.notifikace
for select
to authenticated
using (user_id = auth.uid());

create policy "Uzivatel upravuje svoje notifikace"
on public.notifikace
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Interni system zapisuje notifikace"
on public.notifikace
for insert
to authenticated
with check (true);
