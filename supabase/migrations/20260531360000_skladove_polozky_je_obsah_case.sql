-- Položky vytvořené jako obsah case — skryté v hlavním katalogu skladu.
alter table public.skladove_polozky
  add column if not exists je_obsah_case boolean not null default false;

comment on column public.skladove_polozky.je_obsah_case is
  'Položka typu obsahu case (např. kabinet v case). Nezobrazuje se v hlavním katalogu /sklad/sprava.';

create index if not exists skladove_polozky_je_obsah_case_false_idx
  on public.skladove_polozky (je_obsah_case)
  where je_obsah_case = false;

-- Backfill: položky, jejichž kusy jsou aktivně vložené v case jako child.
update public.skladove_polozky sp
set je_obsah_case = true
where sp.je_obsah_case = false
  and exists (
    select 1
    from public.sklad_polozky_kusy k
    inner join public.sklad_kus_obsah o
      on o.child_kus_id = k.kus_id
      and o.vyjmuto_at is null
    where k.skladova_polozka_id = sp.skladova_polozka_id
  );

-- Synchronizace Celkem z evidence kusů u obsahových položek.
update public.skladove_polozky sp
set celkem_k_dispozici = coalesce(sub.pocet, 0),
    upraveno_dne = now()
from (
  select skladova_polozka_id, count(*)::integer as pocet
  from public.sklad_polozky_kusy
  group by skladova_polozka_id
) sub
where sp.skladova_polozka_id = sub.skladova_polozka_id
  and sp.je_obsah_case = true;
