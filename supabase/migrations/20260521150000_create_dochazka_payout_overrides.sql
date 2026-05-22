create table if not exists public.dochazka_payout_overrides (
  zakazka_id uuid not null references public.zakazky (zakazka_id) on delete cascade,
  user_id uuid not null,
  override_amount_czk numeric(12, 2) not null,
  correction_note text null,
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  primary key (zakazka_id, user_id),
  constraint dochazka_payout_overrides_amount_check check (override_amount_czk >= 0)
);

create index if not exists dochazka_payout_overrides_user_idx
  on public.dochazka_payout_overrides (user_id, zakazka_id);

alter table public.dochazka_payout_overrides enable row level security;

drop policy if exists "Sef cte korekce proplaceni" on public.dochazka_payout_overrides;
drop policy if exists "Sef spravuje korekce proplaceni" on public.dochazka_payout_overrides;

create policy "Sef cte korekce proplaceni"
on public.dochazka_payout_overrides
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef')
  )
);

create policy "Sef spravuje korekce proplaceni"
on public.dochazka_payout_overrides
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.aktivni = true
      and p.role in ('admin', 'sef')
  )
);
