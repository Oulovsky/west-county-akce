-- Sémantická deduplikace fotek poptávky (kanonický source + heuristika typ/název/velikost)

-- 1) Duplicity se stejným kanonickým zdrojem u jedné poptávky
with ranked_canonical as (
  select
    id,
    row_number() over (
      partition by
        poptavka_id,
        typ,
        coalesce(source_fotka_id, id)
      order by created_at asc, id asc
    ) as rn
  from public.poptavka_fotky
)
delete from public.poptavka_fotky f
using ranked_canonical r
where f.id = r.id
  and r.rn > 1;

-- 2) Duplicity se stejným obsahem (typ + název + velikost)
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

-- 3) Sjednotit source_fotka_id na kanonický zdroj u zkopírovaných fotek
update public.poptavka_fotky child
set source_fotka_id = coalesce(parent.source_fotka_id, child.source_fotka_id)
from public.poptavka_fotky parent
where child.source_fotka_id = parent.id
  and parent.source_fotka_id is not null
  and child.source_fotka_id is distinct from parent.source_fotka_id;
