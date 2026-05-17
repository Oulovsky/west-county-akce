alter table public.profiles
  add column if not exists bank_account_number text null,
  add column if not exists bank_code text null,
  add column if not exists iban text null;

alter table public.dochazka_zakazky
  add column if not exists approved_duration_minutes integer null,
  add column if not exists payment_status text not null default 'ceka_na_proplaceni',
  add column if not exists paid_at timestamptz null,
  add column if not exists paid_by uuid null;

alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_payment_status_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_payment_status_check
  check (payment_status in ('ceka_na_proplaceni', 'proplaceno'));

alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_approved_duration_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_approved_duration_check
  check (approved_duration_minutes is null or approved_duration_minutes >= 0);

create index if not exists dochazka_zakazky_payment_status_idx
  on public.dochazka_zakazky (payment_status, checkout_at desc)
  where checkout_at is not null;

create index if not exists profiles_bank_payment_idx
  on public.profiles (user_id, bank_account_number, bank_code, iban);
