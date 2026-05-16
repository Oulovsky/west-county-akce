do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'misto_technicke_poznamky'
      and column_name = 'poznamka_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'misto_technicke_poznamky'
      and column_name = 'id'
  ) then
    alter table public.misto_technicke_poznamky
      rename column poznamka_id to id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'misto_technicke_poznamky'
      and column_name = 'created_by'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'misto_technicke_poznamky'
      and column_name = 'autor_id'
  ) then
    alter table public.misto_technicke_poznamky
      rename column created_by to autor_id;
  end if;
end $$;

create table if not exists public.misto_technicke_poznamky (
  id uuid primary key default gen_random_uuid(),
  misto_id uuid not null references public.mista_konani(misto_id) on delete cascade,
  zakazka_id uuid null references public.zakazky(zakazka_id) on delete set null,
  autor_id uuid null,
  typ text not null,
  text text not null,
  dulezite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.misto_technicke_poznamky
  add column if not exists autor_id uuid null,
  add column if not exists dulezite boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.misto_technicke_poznamky
  alter column id set default gen_random_uuid(),
  alter column misto_id set not null,
  alter column typ set not null,
  alter column text set not null,
  alter column dulezite set default false,
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'misto_technicke_poznamky_autor_id_fkey'
  ) then
    alter table public.misto_technicke_poznamky
      add constraint misto_technicke_poznamky_autor_id_fkey
      foreign key (autor_id) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'misto_technicke_poznamky_typ_check'
  ) then
    alter table public.misto_technicke_poznamky
      add constraint misto_technicke_poznamky_typ_check
      check (typ in ('elektro', 'prijezd', 'parkovani', 'stage', 'hluk', 'omezeni', 'tip', 'problem', 'jina'));
  end if;
end $$;

create index if not exists misto_technicke_poznamky_misto_id_idx
  on public.misto_technicke_poznamky (misto_id);

create index if not exists misto_technicke_poznamky_zakazka_id_idx
  on public.misto_technicke_poznamky (zakazka_id);

create index if not exists misto_technicke_poznamky_created_at_idx
  on public.misto_technicke_poznamky (created_at desc);

create or replace function public.set_misto_technicke_poznamky_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_misto_technicke_poznamky_updated_at
  on public.misto_technicke_poznamky;

create trigger set_misto_technicke_poznamky_updated_at
before update on public.misto_technicke_poznamky
for each row
execute function public.set_misto_technicke_poznamky_updated_at();

alter table public.misto_technicke_poznamky enable row level security;

drop policy if exists "Interni uzivatele ctou technicke poznamky mist" on public.misto_technicke_poznamky;
drop policy if exists "Interni uzivatele pridavaji technicke poznamky mist" on public.misto_technicke_poznamky;

create policy "Interni uzivatele ctou technicke poznamky mist"
on public.misto_technicke_poznamky
for select
to authenticated
using (true);

create policy "Interni uzivatele pridavaji technicke poznamky mist"
on public.misto_technicke_poznamky
for insert
to authenticated
with check (
  auth.uid() is not null
  and (autor_id is null or autor_id = auth.uid())
);
