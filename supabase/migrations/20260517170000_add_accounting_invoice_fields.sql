alter table public.fakturacni_firmy
  add column if not exists platce_dph boolean not null default true,
  add column if not exists vychozi_sazba_dph numeric not null default 21;

alter table public.fakturacni_firmy
  drop constraint if exists fakturacni_firmy_vychozi_sazba_dph_check;

alter table public.fakturacni_firmy
  add constraint fakturacni_firmy_vychozi_sazba_dph_check
  check (vychozi_sazba_dph >= 0 and vychozi_sazba_dph <= 100);

alter table public.zakazka_faktury
  add column if not exists variabilni_symbol text null,
  add column if not exists duzp_at timestamptz null,
  add column if not exists platce_dph boolean not null default true,
  add column if not exists dph_sazba numeric not null default 21,
  add column if not exists zaklad_dane numeric not null default 0,
  add column if not exists dph_castka numeric not null default 0,
  add column if not exists celkem_s_dph numeric not null default 0,
  add column if not exists payment_status text not null default 'neuhrazeno',
  add column if not exists paid_at timestamptz null,
  add column if not exists paid_amount numeric null,
  add column if not exists paid_note text null,
  add column if not exists paid_by uuid null,
  add column if not exists stornovano_at timestamptz null,
  add column if not exists stornovano_by uuid null,
  add column if not exists storno_reason text null;

update public.zakazka_faktury
set
  variabilni_symbol = coalesce(variabilni_symbol, regexp_replace(cislo_dokladu, '\D', '', 'g')),
  duzp_at = coalesce(duzp_at, vystaveno_at),
  zaklad_dane = case when zaklad_dane = 0 then konecna_cena else zaklad_dane end,
  dph_castka = case when dph_castka = 0 and platce_dph then round((konecna_cena * dph_sazba / 100)::numeric, 2) else dph_castka end,
  celkem_s_dph = case
    when celkem_s_dph = 0 then
      case when platce_dph then round((konecna_cena * (1 + dph_sazba / 100))::numeric, 2) else konecna_cena end
    else celkem_s_dph
  end
where celkem_s_dph = 0
  or zaklad_dane = 0
  or variabilni_symbol is null
  or duzp_at is null;

alter table public.zakazka_faktury
  drop constraint if exists zakazka_faktury_stav_check;

alter table public.zakazka_faktury
  add constraint zakazka_faktury_stav_check
  check (stav in ('navrh', 'vystaveno', 'odeslano', 'stornovano'));

alter table public.zakazka_faktury
  drop constraint if exists zakazka_faktury_payment_status_check;

alter table public.zakazka_faktury
  add constraint zakazka_faktury_payment_status_check
  check (payment_status in ('neuhrazeno', 'uhrazeno', 'po_splatnosti', 'stornovano'));

alter table public.zakazka_faktury
  drop constraint if exists zakazka_faktury_dph_sazba_check;

alter table public.zakazka_faktury
  add constraint zakazka_faktury_dph_sazba_check
  check (dph_sazba >= 0 and dph_sazba <= 100);

alter table public.zakazka_faktury
  drop constraint if exists zakazka_faktury_storno_reason_check;

alter table public.zakazka_faktury
  add constraint zakazka_faktury_storno_reason_check
  check (stav <> 'stornovano' or nullif(btrim(coalesce(storno_reason, '')), '') is not null);

create index if not exists zakazka_faktury_payment_status_idx
  on public.zakazka_faktury (payment_status, splatnost_at desc);

create index if not exists zakazka_faktury_vystaveno_idx
  on public.zakazka_faktury (vystaveno_at desc);
