alter table public.zakazky
  add column if not exists zruseno_at timestamptz null,
  add column if not exists zruseno_by uuid null,
  add column if not exists zruseno_duvod text null,
  add column if not exists zruseno_invoice_override_reason text null;

alter table public.zakazky
  drop constraint if exists zakazky_workflow_stav_check;

alter table public.zakazky
  add constraint zakazky_workflow_stav_check
  check (
    workflow_stav in (
      'navrh',
      'cekani_na_schvaleni',
      'schvaleno_klientem',
      'priprava',
      'v_realizaci',
      'dokonceno',
      'fakturovano',
      'archiv',
      'zruseno'
    )
  );

alter table public.zakazky
  drop constraint if exists zakazky_logistika_stav_check;

alter table public.zakazky
  add constraint zakazky_logistika_stav_check
  check (
    logistika_stav in (
      'ceka_na_nakladku',
      'naklada_se',
      'nalozeno',
      'vykladka',
      'vraceno',
      'zruseno'
    )
  );

create index if not exists zakazky_zruseno_idx
  on public.zakazky (zrusena, zruseno_at desc);
