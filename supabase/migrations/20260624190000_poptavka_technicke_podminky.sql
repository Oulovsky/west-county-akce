-- Technické podmínky: režim zadání a potvrzení klientem
alter table public.poptavka_technicke_udaje
  add column if not exists technicke_rezim text
    check (technicke_rezim is null or technicke_rezim in ('klient_vyplni', 'vyjezd_technika')),
  add column if not exists technicke_potvrzeni_odpovednosti_at timestamptz,
  add column if not exists technicke_potvrzeni_vyjezd_ceny_at timestamptz;

comment on column public.poptavka_technicke_udaje.technicke_rezim is
  'klient_vyplni = klient vyplní technické informace sám; vyjezd_technika = placený výjezd technika';
comment on column public.poptavka_technicke_udaje.technicke_potvrzeni_odpovednosti_at is
  'Čas potvrzení odpovědnosti za pravdivost technických informací klientem';
comment on column public.poptavka_technicke_udaje.technicke_potvrzeni_vyjezd_ceny_at is
  'Čas potvrzení ceny a podmínek placeného výjezdu technika klientem';
