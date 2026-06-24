-- Sledování zdroje technických fotek a poznámek místa z převodu poptávky.

alter table public.misto_technicke_fotky
  add column if not exists source_poptavka_id uuid null references public.poptavky (poptavka_id) on delete set null,
  add column if not exists source_poptavka_fotka_id uuid null references public.poptavka_fotky (id) on delete set null,
  add column if not exists source_zakazka_id uuid null references public.zakazky (zakazka_id) on delete set null;

create unique index if not exists misto_technicke_fotky_source_fotka_unique_idx
  on public.misto_technicke_fotky (misto_id, source_poptavka_fotka_id)
  where source_poptavka_fotka_id is not null;

alter table public.misto_technicke_poznamky
  add column if not exists source_poptavka_id uuid null references public.poptavky (poptavka_id) on delete set null,
  add column if not exists source_objednavka_link_id uuid null references public.poptavka_objednavka_links (link_id) on delete set null,
  add column if not exists source_zakazka_id uuid null references public.zakazky (zakazka_id) on delete set null;

create unique index if not exists misto_technicke_poznamky_source_link_unique_idx
  on public.misto_technicke_poznamky (misto_id, source_objednavka_link_id)
  where source_objednavka_link_id is not null;

alter table public.misto_technicke_poznamky
  drop constraint if exists misto_technicke_poznamky_typ_check;

alter table public.misto_technicke_poznamky
  add constraint misto_technicke_poznamky_typ_check
  check (
    typ in (
      'elektro',
      'prijezd',
      'parkovani',
      'stage',
      'hluk',
      'omezeni',
      'tip',
      'problem',
      'jina',
      'revize_objednavka'
    )
  );

comment on column public.misto_technicke_fotky.source_poptavka_fotka_id is
  'Idempotentní vazba na fotku poptávky při převodu na zakázku.';
comment on column public.misto_technicke_poznamky.source_objednavka_link_id is
  'Idempotentní vazba na potvrzený link závazné objednávky při technické revizi místa.';
