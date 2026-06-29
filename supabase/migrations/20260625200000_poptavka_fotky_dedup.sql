-- Deduplikace fotek poptávky + source_fotka_id pro kopie z historie

alter table public.poptavka_fotky
  add column if not exists source_fotka_id uuid null references public.poptavka_fotky (id) on delete set null;

create index if not exists poptavka_fotky_source_fotka_id_idx
  on public.poptavka_fotky (source_fotka_id)
  where source_fotka_id is not null;

-- Odstranit duplicity se stejným storage_path (nemělo by nastat, ale pro jistotu)
with ranked_path as (
  select
    id,
    row_number() over (
      partition by poptavka_id, storage_path
      order by created_at asc, id asc
    ) as rn
  from public.poptavka_fotky
)
delete from public.poptavka_fotky f
using ranked_path r
where f.id = r.id
  and r.rn > 1;

-- Odstranit zřejmé duplicity zkopírovaných fotek (stejný typ, název a velikost u jedné poptávky)
with ranked_heuristic as (
  select
    id,
    row_number() over (
      partition by
        poptavka_id,
        typ,
        coalesce(original_filename, ''),
        coalesce(size_bytes, -1)
      order by created_at asc, id asc
    ) as rn
  from public.poptavka_fotky
  where original_filename is not null
    and size_bytes is not null
)
delete from public.poptavka_fotky f
using ranked_heuristic r
where f.id = r.id
  and r.rn > 1;

-- Po doplnění source_fotka_id odstranit duplicity podle zdroje
with ranked_source as (
  select
    id,
    row_number() over (
      partition by poptavka_id, typ, source_fotka_id
      order by created_at asc, id asc
    ) as rn
  from public.poptavka_fotky
  where source_fotka_id is not null
)
delete from public.poptavka_fotky f
using ranked_source r
where f.id = r.id
  and r.rn > 1;

create unique index if not exists poptavka_fotky_unique_source_fotka
  on public.poptavka_fotky (poptavka_id, typ, source_fotka_id)
  where source_fotka_id is not null;

create unique index if not exists poptavka_fotky_unique_storage_path
  on public.poptavka_fotky (poptavka_id, storage_path);
