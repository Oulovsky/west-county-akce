-- Oprava překlepu e-mailu Jaroslava Prchala (IČO 16697219): @email.com → @email.cz
-- Sloupce dle migrací: klienti.email, poptavky.kontakt_email, client_accounts.user_id → auth.users.email
-- poptavka_technicke_udaje.technik_vyjezd_kontakt_email

do $$
declare
  v_klient_id uuid;
  v_user_id uuid;
  v_wrong_email constant text := 'prchal.jarda@email.com';
  v_correct_email constant text := 'prchal.jarda@email.cz';
  v_ico constant text := '16697219';
begin
  select k.klient_id
  into v_klient_id
  from public.klienti k
  where btrim(coalesce(k.ico, '')) = v_ico
  limit 1;

  if v_klient_id is null then
    raise notice '[prchal email fix] Klient s IČO % nenalezen — migrace přeskočena.', v_ico;
    return;
  end if;

  update public.klienti
  set email = v_correct_email
  where klient_id = v_klient_id
    and lower(btrim(coalesce(email, ''))) = v_wrong_email;

  update public.poptavky
  set kontakt_email = v_correct_email
  where klient_id = v_klient_id
    and lower(btrim(coalesce(kontakt_email, ''))) = v_wrong_email;

  update public.poptavka_technicke_udaje tu
  set technik_vyjezd_kontakt_email = v_correct_email
  from public.poptavky p
  where p.poptavka_id = tu.poptavka_id
    and p.klient_id = v_klient_id
    and lower(btrim(coalesce(tu.technik_vyjezd_kontakt_email, ''))) = v_wrong_email;

  select ca.user_id
  into v_user_id
  from public.client_accounts ca
  where ca.klient_id = v_klient_id
    and ca.stav = 'active'
  order by ca.created_at asc
  limit 1;

  if v_user_id is not null then
    update auth.users
    set email = v_correct_email
    where id = v_user_id
      and lower(btrim(coalesce(email::text, ''))) = v_wrong_email;
  end if;

  raise notice '[prchal email fix] klient_id=% user_id=% poptavky=%',
    v_klient_id,
    v_user_id,
    (
      select coalesce(
        json_agg(
          json_build_object(
            'poptavka_id', p.poptavka_id,
            'cislo_poptavky', p.cislo_poptavky,
            'stav', p.stav,
            'odeslano_at', p.odeslano_at,
            'kontakt_email', p.kontakt_email
          )
          order by p.created_at desc
        ),
        '[]'::json
      )
      from public.poptavky p
      where p.klient_id = v_klient_id
    );
end $$;

comment on table public.poptavky is
  'Klientské poptávky. Interní inbox /zakazky/poptavky zobrazuje jen stavy mimo koncept/ceka_na_schvaleni.';
