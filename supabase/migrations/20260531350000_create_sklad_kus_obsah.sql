-- Vnořené kusy: obsah case (parent obsahuje konkrétní child kusy).

create table if not exists public.sklad_kus_obsah (
  id uuid primary key default gen_random_uuid(),
  parent_kus_id uuid not null references public.sklad_polozky_kusy (kus_id) on delete cascade,
  child_kus_id uuid not null references public.sklad_polozky_kusy (kus_id) on delete cascade,
  pozice text null,
  poznamka text null,
  vlozil_user_id uuid null,
  vlozeno_at timestamptz not null default now(),
  vyjmuto_at timestamptz null,
  vyjmul_user_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sklad_kus_obsah_parent_child_distinct_check
    check (parent_kus_id <> child_kus_id)
);

create unique index if not exists sklad_kus_obsah_active_child_uidx
  on public.sklad_kus_obsah (child_kus_id)
  where vyjmuto_at is null;

create index if not exists sklad_kus_obsah_active_parent_idx
  on public.sklad_kus_obsah (parent_kus_id)
  where vyjmuto_at is null;

create index if not exists sklad_kus_obsah_vlozeno_at_idx
  on public.sklad_kus_obsah (vlozeno_at desc);

alter table public.sklad_kus_historie
  drop constraint if exists sklad_kus_historie_typ_akce_check;

alter table public.sklad_kus_historie
  add constraint sklad_kus_historie_typ_akce_check
  check (
    typ_akce in (
      'rezervovano',
      'nalozeno',
      'vraceno',
      'poskozeno',
      'blokovano',
      'odblokovano',
      'v_oprave',
      'ceka_na_kontrolu',
      'zkontrolovano',
      'vyrazeno',
      'servisni_poznamka',
      'vlozeno_do_case',
      'vyjmuto_z_case'
    )
  );

alter table public.sklad_kus_obsah enable row level security;

drop policy if exists "Interni ctou sklad kus obsah" on public.sklad_kus_obsah;
drop policy if exists "Operational zapisuji sklad kus obsah" on public.sklad_kus_obsah;
drop policy if exists "Operational upravuji sklad kus obsah" on public.sklad_kus_obsah;

create policy "Interni ctou sklad kus obsah"
on public.sklad_kus_obsah for select to authenticated
using (public.is_active_internal_reader());

create policy "Operational zapisuji sklad kus obsah"
on public.sklad_kus_obsah for insert to authenticated
with check (public.is_operational_write_user());

create policy "Operational upravuji sklad kus obsah"
on public.sklad_kus_obsah for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
