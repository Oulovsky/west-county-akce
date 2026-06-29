-- Náhledy fotek poptávky (thumbnail pro rychlé zobrazení v portálu)

alter table public.poptavka_fotky
  add column if not exists thumbnail_storage_path text null,
  add column if not exists thumbnail_size_bytes bigint null;

create index if not exists poptavka_fotky_thumbnail_path_idx
  on public.poptavka_fotky (poptavka_id, thumbnail_storage_path)
  where thumbnail_storage_path is not null;
