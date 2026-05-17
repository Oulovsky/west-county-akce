create extension if not exists pgcrypto;

alter table public.zakazky
  add column if not exists workflow_stav text not null default 'navrh',
  add column if not exists workflow_changed_at timestamptz null,
  add column if not exists workflow_changed_by uuid null;

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
      'archiv'
    )
  );

update public.zakazky
set workflow_stav = case
  when coalesce(logistika_stav, '') = 'vraceno' then 'dokonceno'
  when coalesce(logistika_stav, '') in ('naklada_se', 'nalozeno') then 'priprava'
  when coalesce(logistika_stav, '') = 'vykladka' then 'v_realizaci'
  when coalesce(client_approval_status, '') = 'approved' then 'schvaleno_klientem'
  when coalesce(client_approval_status, '') = 'sent_for_approval' then 'cekani_na_schvaleni'
  else 'navrh'
end,
workflow_changed_at = coalesce(workflow_changed_at, now())
where workflow_changed_at is null
  or workflow_stav = 'navrh';

create sequence if not exists public.zakazka_faktury_cislo_seq;

create or replace function public.next_zakazka_faktura_cislo()
returns text
language sql
as $$
  select to_char(now(), 'YYYY') || '-' || lpad(nextval('public.zakazka_faktury_cislo_seq')::text, 4, '0');
$$;

create table if not exists public.zakazka_faktury (
  id uuid primary key default gen_random_uuid(),
  zakazka_id uuid not null references public.zakazky(zakazka_id) on delete cascade,
  cislo_dokladu text not null unique,
  stav text not null default 'navrh',
  vystaveno_at timestamptz null,
  splatnost_at timestamptz null,
  odeslano_at timestamptz null,
  email_to text null,
  fakturacni_firma_id uuid null references public.fakturacni_firmy(id) on delete set null,
  supplier_snapshot jsonb not null default '{}'::jsonb,
  customer_snapshot jsonb not null default '{}'::jsonb,
  order_snapshot jsonb not null default '{}'::jsonb,
  cena_techniky numeric not null default 0,
  cena_personalu numeric not null default 0,
  cena_pred_slevou numeric not null default 0,
  sleva_percent numeric not null default 0,
  sleva_castka numeric not null default 0,
  konecna_cena numeric not null default 0,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zakazka_faktury_stav_check check (stav in ('navrh', 'vystaveno', 'odeslano'))
);

create index if not exists zakazka_faktury_zakazka_created_idx
  on public.zakazka_faktury (zakazka_id, created_at desc);

comment on table public.zakazka_faktury is
  'Technicky dluh: RLS je zatim omezene na aktivni interni profily. Finalni role-based fakturacni opravneni doplnit pri role systemu.';

alter table public.zakazka_faktury enable row level security;

drop policy if exists "Interni uzivatele ctou faktury zakazek" on public.zakazka_faktury;
create policy "Interni uzivatele ctou faktury zakazek"
on public.zakazka_faktury
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.aktivni, true) = true
  )
);

drop policy if exists "Interni uzivatele spravuji faktury zakazek" on public.zakazka_faktury;
create policy "Interni uzivatele spravuji faktury zakazek"
on public.zakazka_faktury
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.aktivni, true) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.aktivni, true) = true
  )
);
