create table if not exists public.dochazka_zakazky (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky(zakazka_id) on delete cascade,
  assignment_id text null,
  user_id uuid not null,
  typ_faze text not null,
  checkin_at timestamptz not null default now(),
  checkout_at timestamptz null,
  gps_checkin_lat double precision null,
  gps_checkin_lng double precision null,
  gps_checkout_lat double precision null,
  gps_checkout_lng double precision null,
  gps_accuracy double precision null,
  gps_checkout_accuracy double precision null,
  manual_override boolean not null default false,
  override_reason text null,
  approved_by uuid null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dochazka_zakazky_typ_faze_check
    check (typ_faze in ('nakladka', 'stavba', 'provoz', 'bourani')),
  constraint dochazka_zakazky_checkout_after_checkin_check
    check (checkout_at is null or checkout_at >= checkin_at),
  constraint dochazka_zakazky_manual_override_reason_check
    check (manual_override = false or nullif(btrim(coalesce(override_reason, '')), '') is not null)
);

create index if not exists dochazka_zakazky_zakazka_idx
  on public.dochazka_zakazky (zakazka_id, checkin_at desc);

create index if not exists dochazka_zakazky_user_idx
  on public.dochazka_zakazky (user_id, checkin_at desc);

create index if not exists dochazka_zakazky_assignment_idx
  on public.dochazka_zakazky (assignment_id, checkin_at desc);

create index if not exists dochazka_zakazky_open_user_idx
  on public.dochazka_zakazky (user_id)
  where checkout_at is null;

alter table public.dochazka_zakazky enable row level security;

drop policy if exists "Interni uzivatele ctou dochazku" on public.dochazka_zakazky;
drop policy if exists "Zamestnanec zapisuje vlastni dochazku" on public.dochazka_zakazky;
drop policy if exists "Sef upravuje dochazku" on public.dochazka_zakazky;

create policy "Interni uzivatele ctou dochazku"
on public.dochazka_zakazky
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef', 'skladnik')
  )
);

create policy "Zamestnanec zapisuje vlastni dochazku"
on public.dochazka_zakazky
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Sef upravuje dochazku"
on public.dochazka_zakazky
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef', 'skladnik')
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef', 'skladnik')
  )
);
