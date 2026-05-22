-- Schválení vs. proplacení, nárok vs. uznání, přejezd, palivové náhrady

-- =============================================================================
-- A) DOCHÁZKA
-- =============================================================================

alter table public.dochazka_zakazky
  add column if not exists claimed_duration_minutes integer null,
  add column if not exists claimed_amount_czk numeric(12,2) null,
  add column if not exists approval_status text not null default 'ceka_na_schvaleni',
  add column if not exists approved_amount_czk numeric(12,2) null,
  add column if not exists correction_note text null,
  add column if not exists doprava_rezim text null;

alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_typ_faze_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_typ_faze_check
  check (typ_faze in ('nakladka', 'stavba', 'provoz', 'bourani', 'prejezd'));

alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_doprava_rezim_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_doprava_rezim_check
  check (
    doprava_rezim is null
    or doprava_rezim in ('firemni', 'soukrome', 'spolujizda', 'bez_nahrady')
  );

alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_approval_status_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_approval_status_check
  check (approval_status in ('ceka_na_schvaleni', 'schvaleno', 'zamitneto'));

alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_claimed_duration_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_claimed_duration_check
  check (claimed_duration_minutes is null or claimed_duration_minutes >= 0);

alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_approved_amount_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_approved_amount_check
  check (approved_amount_czk is null or approved_amount_czk >= 0);

alter table public.dochazka_zakazky
  drop constraint if exists dochazka_zakazky_prejezd_rezim_check;

alter table public.dochazka_zakazky
  add constraint dochazka_zakazky_prejezd_rezim_check
  check (typ_faze <> 'prejezd' or doprava_rezim is not null);

create index if not exists dochazka_zakazky_approval_idx
  on public.dochazka_zakazky (zakazka_id, user_id, approval_status, payment_status);

update public.dochazka_zakazky dz
set
  claimed_duration_minutes = coalesce(
    dz.approved_duration_minutes,
    greatest(0, (extract(epoch from (dz.checkout_at - dz.checkin_at)) / 60)::integer)
  ),
  approval_status = case
    when dz.payment_status = 'proplaceno' then 'schvaleno'
    else 'ceka_na_schvaleni'
  end
where dz.checkout_at is not null
  and dz.claimed_duration_minutes is null;

-- =============================================================================
-- B) CESTOVNÍ NÁHRADY
-- =============================================================================

alter table public.cestovni_nahrady
  add column if not exists doprava_rezim text not null default 'soukrome_auto',
  add column if not exists spotreba_l_100km numeric(8,2) null,
  add column if not exists cena_paliva_kc_l numeric(10,2) null,
  add column if not exists claimed_km numeric(10,2) null,
  add column if not exists claimed_amount_czk numeric(12,2) null,
  add column if not exists approved_km numeric(10,2) null,
  add column if not exists approved_amount_czk numeric(12,2) null,
  add column if not exists correction_note text null,
  add column if not exists approval_status text not null default 'ceka_na_schvaleni',
  add column if not exists payment_status text not null default 'ceka_na_proplaceni';

update public.cestovni_nahrady cn
set
  claimed_km = coalesce(cn.claimed_km, cn.km),
  claimed_amount_czk = coalesce(cn.claimed_amount_czk, cn.castka, cn.km * cn.sazba_za_km),
  approval_status = case
    when cn.status in ('schvaleno', 'proplaceno') then 'schvaleno'
    when cn.status = 'zamitnuto' then 'zamitneto'
    else 'ceka_na_schvaleni'
  end,
  payment_status = case
    when cn.status = 'proplaceno' then 'proplaceno'
    else 'ceka_na_proplaceni'
  end,
  approved_km = case when cn.status in ('schvaleno', 'proplaceno') then coalesce(cn.approved_km, cn.km) else cn.approved_km end,
  approved_amount_czk = case
    when cn.status in ('schvaleno', 'proplaceno') then coalesce(cn.approved_amount_czk, cn.castka, cn.km * cn.sazba_za_km)
    else cn.approved_amount_czk
  end,
  correction_note = coalesce(cn.correction_note, cn.rejected_reason)
where cn.claimed_km is null or cn.approval_status = 'ceka_na_schvaleni';

alter table public.cestovni_nahrady drop column if exists castka;

alter table public.cestovni_nahrady
  drop constraint if exists cestovni_nahrady_doprava_rezim_check;

alter table public.cestovni_nahrady
  add constraint cestovni_nahrady_doprava_rezim_check
  check (doprava_rezim in ('firemni_auto', 'soukrome_auto', 'spolujizda', 'bez_nahrady'));

alter table public.cestovni_nahrady
  drop constraint if exists cestovni_nahrady_approval_status_check;

alter table public.cestovni_nahrady
  add constraint cestovni_nahrady_approval_status_check
  check (approval_status in ('ceka_na_schvaleni', 'schvaleno', 'zamitneto'));

alter table public.cestovni_nahrady
  drop constraint if exists cestovni_nahrady_payment_status_check;

alter table public.cestovni_nahrady
  add constraint cestovni_nahrady_payment_status_check
  check (payment_status in ('ceka_na_proplaceni', 'proplaceno'));

create index if not exists cestovni_nahrady_approval_payment_idx
  on public.cestovni_nahrady (zakazka_id, user_id, approval_status, payment_status);
