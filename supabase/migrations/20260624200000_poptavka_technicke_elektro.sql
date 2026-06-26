-- Elektro / rozvaděč — strukturovaná pole technických podmínek
alter table public.poptavka_technicke_udaje
  add column if not exists elektro_zdroj_typ text
    check (elektro_zdroj_typ is null or elektro_zdroj_typ in ('pevna_pripojka', 'elektrocentrala')),
  add column if not exists hlavni_chranic_vetve text,
  add column if not exists pripojky_16a_count integer
    check (pripojky_16a_count is null or pripojky_16a_count >= 0),
  add column if not exists pripojky_32a_count integer
    check (pripojky_32a_count is null or pripojky_32a_count >= 0),
  add column if not exists pripojky_64a_count integer
    check (pripojky_64a_count is null or pripojky_64a_count >= 0),
  add column if not exists pripojky_125a_count integer
    check (pripojky_125a_count is null or pripojky_125a_count >= 0),
  add column if not exists stage_pripojka_rezim text
    check (
      stage_pripojka_rezim is null
      or stage_pripojka_rezim in ('samostatna_pro_stage', 'sdilena_s_dalsimi_odbery')
    );

-- Nový typ fotky pro sekci povrch / přístup
alter table public.poptavka_fotky
  drop constraint if exists poptavka_fotky_typ_check;

alter table public.poptavka_fotky
  add constraint poptavka_fotky_typ_check
  check (
    typ in (
      'rozvadec',
      'prijezd',
      'plocha_stage',
      'povrch_pristup',
      'misto_akce',
      'jina'
    )
  );
