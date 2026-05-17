alter table public.zakazky
add column if not exists logistika_stav text not null default 'ceka_na_nakladku',
add column if not exists nakladka_started_by uuid,
add column if not exists nakladka_started_at timestamp with time zone,
add column if not exists nakladka_completed_by uuid,
add column if not exists nakladka_completed_at timestamp with time zone,
add column if not exists vykladka_started_by uuid,
add column if not exists vykladka_started_at timestamp with time zone,
add column if not exists vraceno_completed_by uuid,
add column if not exists vraceno_completed_at timestamp with time zone;

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
    'vraceno'
  )
);

update public.zakazky
set logistika_stav = 'ceka_na_nakladku'
where logistika_stav is null;
