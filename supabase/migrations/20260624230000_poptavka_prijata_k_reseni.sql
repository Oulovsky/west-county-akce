-- Stav „přijata k řešení“ — šéf přijal odeslanou poptávku a může připravit návrh objednávky.

alter table public.poptavky
  drop constraint if exists poptavky_stav_check;

alter table public.poptavky
  add constraint poptavky_stav_check
  check (
    stav in (
      'koncept',
      'odeslana',
      'ceka_na_schvaleni',
      'v_revizi',
      'prijata_k_reseni',
      'schvalena',
      'zamitnuta',
      'prevadena_do_zakazky',
      'objednavka_odeslana',
      'objednavka_potvrzena',
      'objednavka_odmitnuta'
    )
  );

alter table public.poptavky
  add column if not exists prijata_k_reseni_at timestamptz null,
  add column if not exists prijala_user_id uuid null references public.profiles (user_id) on delete set null;

comment on column public.poptavky.prijata_k_reseni_at is
  'Kdy interní tým přijal odeslanou poptávku k řešení.';
comment on column public.poptavky.prijala_user_id is
  'Kdo interně přijal poptávku k řešení.';
