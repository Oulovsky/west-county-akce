alter table public.sklad_polozky_kusy
  add column if not exists servisni_poznamka text null,
  add column if not exists servisni_stav_changed_at timestamptz null,
  add column if not exists servisni_stav_changed_by uuid null;

alter table public.sklad_polozky_kusy
  drop constraint if exists sklad_polozky_kusy_stav_check;

alter table public.sklad_polozky_kusy
  add constraint sklad_polozky_kusy_stav_check
  check (
    stav in (
      'skladem',
      'na_akci',
      'na_zakazce',
      'poskozeno',
      'blokovano',
      'v_oprave',
      'ceka_na_kontrolu',
      'odpis',
      'vyrazeno'
    )
  );

alter table public.sklad_kus_historie
  drop constraint if exists sklad_kus_historie_typ_akce_check;

alter table public.sklad_kus_historie
  add constraint sklad_kus_historie_typ_akce_check
  check (
    typ_akce in (
      'rezervovano',
      'nalozeno',
      'vraceno',
      'poskozeno',
      'blokovano',
      'odblokovano',
      'v_oprave',
      'ceka_na_kontrolu',
      'zkontrolovano',
      'vyrazeno',
      'servisni_poznamka'
    )
  );

create index if not exists sklad_polozky_kusy_stav_idx
  on public.sklad_polozky_kusy (stav, aktivni);
