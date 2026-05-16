insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dotaznik-fotky',
  'dotaznik-fotky',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.dotaznik_fotky (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky(zakazka_id) on delete cascade,
  dotaznik_odpoved_id uuid null references public.zakazka_dotazniky(dotaznik_id) on delete cascade,
  token_id uuid null references public.zakazka_client_links(link_id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  typ text not null,
  popis text null,
  poradi integer not null default 0,
  original_filename text null,
  mime_type text null,
  size_bytes integer null,
  created_at timestamptz not null default now()
);

create index if not exists dotaznik_fotky_zakazka_id_idx
  on public.dotaznik_fotky (zakazka_id);

create index if not exists dotaznik_fotky_dotaznik_odpoved_id_idx
  on public.dotaznik_fotky (dotaznik_odpoved_id);

create index if not exists dotaznik_fotky_token_id_idx
  on public.dotaznik_fotky (token_id);
