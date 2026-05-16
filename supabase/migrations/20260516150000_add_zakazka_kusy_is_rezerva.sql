alter table public.zakazka_kusy
  add column if not exists is_rezerva boolean not null default false;

create index if not exists zakazka_kusy_zakazka_rezerva_idx
  on public.zakazka_kusy (zakazka_id, is_rezerva);
