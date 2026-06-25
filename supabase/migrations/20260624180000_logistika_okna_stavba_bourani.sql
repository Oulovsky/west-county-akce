-- Klientské časové okno stavby/bourání vs. interní realizační časy na zakázce.
-- Stará pole (stavba_datum, stavba_cas_*, zakazky.stavba_od/do) zůstávají beze změny.

alter table public.poptavky
  add column if not exists stavba_okno_od timestamptz null,
  add column if not exists stavba_okno_do timestamptz null,
  add column if not exists bourani_okno_od timestamptz null,
  add column if not exists bourani_okno_do timestamptz null,
  add column if not exists logistika_poznamka_klienta text null;

alter table public.zakazky
  add column if not exists stavba_okno_od timestamptz null,
  add column if not exists stavba_okno_do timestamptz null,
  add column if not exists bourani_okno_od timestamptz null,
  add column if not exists bourani_okno_do timestamptz null;

comment on column public.poptavky.stavba_okno_od is
  'Klientské okno: nejdřívější možný začátek stavby (ne přesný termín realizace).';
comment on column public.poptavky.stavba_okno_do is
  'Klientské okno: nejpozdější možný konec stavby.';
comment on column public.poptavky.bourani_okno_od is
  'Klientské okno: nejdřívější možný začátek bourání.';
comment on column public.poptavky.bourani_okno_do is
  'Klientské okno: nejpozdější možné bourání / uvolnění místa.';
comment on column public.poptavky.logistika_poznamka_klienta is
  'Poznámka klienta k přístupu, omezením a logistice stavby/bourání.';
comment on column public.zakazky.stavba_okno_od is
  'Klientské okno stavby (interní reference, ne pro zaměstnance jako nástup).';
comment on column public.zakazky.stavba_okno_do is
  'Klientské okno stavby — konec.';
comment on column public.zakazky.bourani_okno_od is
  'Klientské okno bourání — začátek.';
comment on column public.zakazky.bourani_okno_do is
  'Klientské okno bourání — konec.';

-- Backfill klientského okna ze starých jednodenních polí (pokud nová okna chybí).
update public.poptavky
set
  stavba_okno_od = (stavba_datum::text || 'T' || coalesce(stavba_cas_od::text, '00:00:00'))::timestamptz,
  stavba_okno_do = (stavba_datum::text || 'T' || coalesce(stavba_cas_do::text, '23:59:59'))::timestamptz
where stavba_datum is not null
  and stavba_okno_od is null
  and stavba_okno_do is null;

update public.poptavky
set
  bourani_okno_od = (bourani_datum::text || 'T' || coalesce(bourani_cas_od::text, '00:00:00'))::timestamptz,
  bourani_okno_do = (bourani_datum::text || 'T' || coalesce(bourani_cas_do::text, '23:59:59'))::timestamptz
where bourani_datum is not null
  and bourani_okno_od is null
  and bourani_okno_do is null;

-- U zakázek z poptávky: okno z poptávky (realizační stavba_od/do ponecháme — mohly být ručně nastaveny).
update public.zakazky z
set
  stavba_okno_od = p.stavba_okno_od,
  stavba_okno_do = p.stavba_okno_do,
  bourani_okno_od = p.bourani_okno_od,
  bourani_okno_do = p.bourani_okno_do
from public.poptavky p
where p.zakazka_id = z.zakazka_id
  and p.zakazka_id is not null
  and z.stavba_okno_od is null
  and (p.stavba_okno_od is not null or p.bourani_okno_od is not null);
