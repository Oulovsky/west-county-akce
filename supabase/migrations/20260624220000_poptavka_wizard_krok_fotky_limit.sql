-- Poslední rozpracovaný krok wizardu + vyšší limit fotek v bucketu poptavka-fotky

alter table public.poptavky
  add column if not exists wizard_krok smallint null;

alter table public.poptavky
  drop constraint if exists poptavky_wizard_krok_check;

alter table public.poptavky
  add constraint poptavky_wizard_krok_check
  check (wizard_krok is null or (wizard_krok >= 1 and wizard_krok <= 4));

comment on column public.poptavky.wizard_krok is
  'Poslední rozpracovaný krok klientského wizardu (1–4).';

update storage.buckets
set file_size_limit = 26214400
where id = 'poptavka-fotky';
