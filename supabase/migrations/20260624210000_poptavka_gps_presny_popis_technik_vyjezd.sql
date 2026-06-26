-- Přesný popis místa akce + data závazné objednávky výjezdu technika
alter table public.poptavky
  add column if not exists presny_popis_mista text;

alter table public.poptavka_technicke_udaje
  add column if not exists technik_vyjezd_objednan_at timestamptz,
  add column if not exists technik_vyjezd_potvrzeni_fakturace_at timestamptz,
  add column if not exists technik_vyjezd_kontakt_jmeno text,
  add column if not exists technik_vyjezd_kontakt_telefon text,
  add column if not exists technik_vyjezd_kontakt_email text,
  add column if not exists technik_vyjezd_preferuje_telefon boolean not null default false,
  add column if not exists technik_vyjezd_preferuje_email boolean not null default false,
  add column if not exists technik_vyjezd_vzdalenost_km numeric,
  add column if not exists technik_vyjezd_doprava_kc numeric,
  add column if not exists technik_vyjezd_vypocet_typ text
    check (
      technik_vyjezd_vypocet_typ is null
      or technik_vyjezd_vypocet_typ in ('google_directions', 'orientacni_vzdusna_cara')
    );
