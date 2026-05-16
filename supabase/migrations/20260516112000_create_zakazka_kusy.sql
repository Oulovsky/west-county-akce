create extension if not exists pgcrypto;

create table if not exists public.zakazka_kusy (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky(zakazka_id) on delete cascade,
  kus_id uuid not null references public.sklad_polozky_kusy(kus_id) on delete cascade,
  stav text not null default 'rezervovano',
  created_at timestamptz not null default now(),
  constraint zakazka_kusy_stav_check check (
    stav in ('rezervovano', 'nalozeno', 'vratit', 'vraceno', 'poskozeno')
  )
);

create index if not exists zakazka_kusy_zakazka_id_idx
  on public.zakazka_kusy (zakazka_id);

create index if not exists zakazka_kusy_kus_id_idx
  on public.zakazka_kusy (kus_id);

create index if not exists zakazka_kusy_kus_stav_idx
  on public.zakazka_kusy (kus_id, stav);

create unique index if not exists zakazka_kusy_one_active_per_kus_idx
  on public.zakazka_kusy (kus_id)
  where stav in ('rezervovano', 'nalozeno', 'vratit', 'poskozeno');
