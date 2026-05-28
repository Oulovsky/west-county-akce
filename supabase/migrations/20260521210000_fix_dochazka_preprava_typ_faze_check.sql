-- Oprava: produkce měla stále starý CHECK bez 'preprava' (20260521180000 nebyla aplikována nebo selhala před ALTER).
alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_typ_faze_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_typ_faze_check
    check (typ_faze in ('nakladka', 'stavba', 'provoz', 'bourani', 'preprava'));

-- Sloupce pro přepravu (idempotentně, pokud chyběly z předchozí migrace)
alter table public.dochazka_zakazky
  add column if not exists transport_vehicle_mode text null,
  add column if not exists vozidlo_id uuid null references public.vozidla(id) on delete set null;

alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_transport_vehicle_mode_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_transport_vehicle_mode_check
    check (
      transport_vehicle_mode is null
      or transport_vehicle_mode in ('firemni', 'vlastni')
    );

alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_transport_vehicle_consistency_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_transport_vehicle_consistency_check
    check (
      typ_faze <> 'preprava'
      or transport_vehicle_mode is not null
    );

select pg_notify('pgrst', 'reload schema');
