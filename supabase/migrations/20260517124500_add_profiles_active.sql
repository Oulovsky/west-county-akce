alter table public.profiles
  add column if not exists aktivni boolean not null default true;

create index if not exists profiles_aktivni_idx
  on public.profiles (aktivni, prijmeni, jmeno);
