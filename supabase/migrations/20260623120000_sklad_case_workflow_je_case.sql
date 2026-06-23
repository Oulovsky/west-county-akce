-- Case workflow — sloupec je_case na skladove_polozky.
-- Tabulka sklad_kus_obsah a sloupec je_obsah_case jsou v migracích:
--   20260531350000_create_sklad_kus_obsah.sql
--   20260531360000_skladove_polozky_je_obsah_case.sql
--
-- V kódu je parent_kus_id (= case kus), pozice text, soft-delete přes vyjmuto_at.

alter table public.skladove_polozky
  add column if not exists je_case boolean not null default false;

comment on column public.skladove_polozky.je_case is
  'Položka je case (vnější obal). Nastavuje se při vytvoření case nebo ručně ve správě skladu.';

create index if not exists skladove_polozky_je_case_true_idx
  on public.skladove_polozky (je_case)
  where je_case = true;

-- Backfill: existující case položky podle jednotky nebo názvu (stejná heuristika jako v aplikaci).
update public.skladove_polozky
set je_case = true,
    upraveno_dne = now()
where je_case = false
  and (
    lower(trim(coalesce(jednotka, ''))) = 'case'
    or trim(nazev) ~* '^case\b'
  );

-- Grants pro sklad_kus_obsah (RLS je v 20260531350000; tabulové granty doplňujeme idempotentně).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'sklad_kus_obsah'
  ) then
    grant select, insert, update, delete on table public.sklad_kus_obsah to authenticated;
    grant all on table public.sklad_kus_obsah to service_role;
  end if;
end $$;
