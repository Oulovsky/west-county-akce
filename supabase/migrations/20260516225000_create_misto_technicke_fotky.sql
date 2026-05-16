insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mista-fotky',
  'mista-fotky',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.misto_technicke_fotky (
  id uuid primary key default gen_random_uuid(),
  misto_id uuid not null references public.mista_konani(misto_id) on delete cascade,
  zakazka_id uuid null references public.zakazky(zakazka_id) on delete set null,
  autor_id uuid null references auth.users(id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  typ text not null,
  popis text null,
  dulezite boolean not null default false,
  original_filename text null,
  mime_type text null,
  size_bytes integer null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'misto_technicke_fotky_typ_check'
  ) then
    alter table public.misto_technicke_fotky
      add constraint misto_technicke_fotky_typ_check
      check (typ in ('rozvadec', 'prijezd', 'parkovani', 'kabel', 'stage', 'omezeni', 'problem', 'jina'));
  end if;
end $$;

create index if not exists misto_technicke_fotky_misto_id_idx
  on public.misto_technicke_fotky (misto_id);

create index if not exists misto_technicke_fotky_zakazka_id_idx
  on public.misto_technicke_fotky (zakazka_id);

create index if not exists misto_technicke_fotky_created_at_idx
  on public.misto_technicke_fotky (created_at desc);

alter table public.misto_technicke_fotky enable row level security;

drop policy if exists "Interni uzivatele ctou technicke fotky mist" on public.misto_technicke_fotky;
drop policy if exists "Interni uzivatele pridavaji technicke fotky mist" on public.misto_technicke_fotky;

create policy "Interni uzivatele ctou technicke fotky mist"
on public.misto_technicke_fotky
for select
to authenticated
using (true);

create policy "Interni uzivatele pridavaji technicke fotky mist"
on public.misto_technicke_fotky
for insert
to authenticated
with check (
  auth.uid() is not null
  and (autor_id is null or autor_id = auth.uid())
);
