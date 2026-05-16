create extension if not exists pgcrypto;

create table if not exists public.sklad_kus_historie (
  historie_id uuid primary key default gen_random_uuid(),
  kus_id uuid not null references public.sklad_polozky_kusy(kus_id) on delete cascade,
  zakazka_id uuid null references public.zakazky(zakazka_id) on delete set null,
  typ_akce text not null,
  poznamka text null,
  created_at timestamptz not null default now(),
  constraint sklad_kus_historie_typ_akce_check check (
    typ_akce in (
      'rezervovano',
      'nalozeno',
      'vraceno',
      'poskozeno',
      'blokovano',
      'odblokovano'
    )
  )
);

create index if not exists sklad_kus_historie_kus_id_idx
  on public.sklad_kus_historie (kus_id);

create index if not exists sklad_kus_historie_created_at_idx
  on public.sklad_kus_historie (created_at desc);

create index if not exists sklad_kus_historie_kus_created_at_idx
  on public.sklad_kus_historie (kus_id, created_at desc);
