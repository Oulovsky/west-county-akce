-- FÁZE 2.3: DB/RLS ochrana pro roli hdt (read-only interní uživatel).
-- Cíl: SELECT tam, kde má HDT číst; blokovat INSERT/UPDATE/DELETE včetně obcházení přes Supabase klienta.

-- ---------------------------------------------------------------------------
-- Helper funkce pro role / RLS
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
    and coalesce(p.aktivni, true) = true
  limit 1;
$$;

create or replace function public.is_active_internal_reader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.aktivni, true) = true
      and p.role in ('admin', 'sef', 'skladnik', 'zamestnanec', 'hdt')
  );
$$;

create or replace function public.is_internal_write_excluding_hdt()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.aktivni, true) = true
      and p.role in ('admin', 'sef', 'skladnik', 'zamestnanec')
  );
$$;

create or replace function public.is_operational_write_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.aktivni, true) = true
      and p.role in ('admin', 'sef', 'skladnik')
  );
$$;

create or replace function public.is_finance_read_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.aktivni, true) = true
      and p.role in ('admin', 'sef', 'skladnik', 'hdt')
  );
$$;

create or replace function public.assert_internal_write_allowed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_role() = 'hdt' then
    raise exception 'FORBIDDEN_HDT_READ_ONLY';
  end if;

  if not public.is_active_internal_reader() then
    raise exception 'FORBIDDEN';
  end if;
end;
$$;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_active_internal_reader() to authenticated;
grant execute on function public.is_internal_write_excluding_hdt() to authenticated;
grant execute on function public.is_operational_write_user() to authenticated;
grant execute on function public.is_finance_read_user() to authenticated;
grant execute on function public.assert_internal_write_allowed() to authenticated;

-- ---------------------------------------------------------------------------
-- 1) Finance / fakturace
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can manage fakturacni_firmy" on public.fakturacni_firmy;
create policy "Interni uzivatele spravuji fakturacni firmy"
on public.fakturacni_firmy
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

create policy "Interni uzivatele upravuji fakturacni firmy"
on public.fakturacni_firmy
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

create policy "Interni uzivatele mazaji fakturacni firmy"
on public.fakturacni_firmy
for delete
to authenticated
using (public.is_internal_write_excluding_hdt());

drop policy if exists "Interni uzivatele spravuji faktury zakazek" on public.zakazka_faktury;
create policy "Interni uzivatele vkladaji faktury zakazek"
on public.zakazka_faktury
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

create policy "Interni uzivatele upravuji faktury zakazek"
on public.zakazka_faktury
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

create policy "Interni uzivatele mazaji faktury zakazek"
on public.zakazka_faktury
for delete
to authenticated
using (public.is_internal_write_excluding_hdt());

drop policy if exists "Admin cte ucetni konfiguraci" on public.ucetni_konfigurace;
create policy "Admin cte ucetni konfiguraci"
on public.ucetni_konfigurace
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.aktivni, true) = true
  )
);

create policy "Hdt cte ucetni konfiguraci"
on public.ucetni_konfigurace
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'hdt'
      and coalesce(p.aktivni, true) = true
  )
);

-- ---------------------------------------------------------------------------
-- 2) Existující tabulky s FOR ALL / širokým write – rozdělit a vyloučit hdt
-- ---------------------------------------------------------------------------

drop policy if exists "Interni uzivatele spravuji schvaleni zakazky" on public.zakazka_approval_links;
create policy "Interni uzivatele vkladaji schvaleni zakazky"
on public.zakazka_approval_links
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

create policy "Interni uzivatele upravuji schvaleni zakazky"
on public.zakazka_approval_links
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

create policy "Interni uzivatele mazaji schvaleni zakazky"
on public.zakazka_approval_links
for delete
to authenticated
using (public.is_internal_write_excluding_hdt());

drop policy if exists "Interni uzivatele zapisujou historii zakazky" on public.zakazka_historie;
create policy "Interni uzivatele zapisujou historii zakazky"
on public.zakazka_historie
for insert
to authenticated
with check (
  public.is_internal_write_excluding_hdt()
  and (auth.uid() = actor_id or actor_id is null)
);

drop policy if exists "Interni uzivatele pridavaji technicke poznamky mist" on public.misto_technicke_poznamky;
create policy "Interni uzivatele pridavaji technicke poznamky mist"
on public.misto_technicke_poznamky
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

create policy "Interni uzivatele upravuji technicke poznamky mist"
on public.misto_technicke_poznamky
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

create policy "Interni uzivatele mazaji technicke poznamky mist"
on public.misto_technicke_poznamky
for delete
to authenticated
using (public.is_internal_write_excluding_hdt());

drop policy if exists "Interni uzivatele pridavaji technicke fotky mist" on public.misto_technicke_fotky;
create policy "Interni uzivatele pridavaji technicke fotky mist"
on public.misto_technicke_fotky
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

create policy "Interni uzivatele upravuji technicke fotky mist"
on public.misto_technicke_fotky
for update
to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());

create policy "Interni uzivatele mazaji technicke fotky mist"
on public.misto_technicke_fotky
for delete
to authenticated
using (public.is_internal_write_excluding_hdt());

drop policy if exists "Interni system zapisuje notifikace" on public.notifikace;
create policy "Interni system zapisuje notifikace"
on public.notifikace
for insert
to authenticated
with check (public.is_internal_write_excluding_hdt());

drop policy if exists "Interni uzivatele ctou dopravu" on public.zakazka_doprava;
create policy "Interni uzivatele ctou dopravu"
on public.zakazka_doprava
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.aktivni, true) = true
      and p.role in ('admin', 'sef', 'skladnik', 'hdt')
  )
);

drop policy if exists "Interni uzivatele ctou cestovni nahrady" on public.cestovni_nahrady;
create policy "Interni uzivatele ctou cestovni nahrady"
on public.cestovni_nahrady
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.aktivni, true) = true
      and p.role in ('admin', 'sef', 'hdt')
  )
);

drop policy if exists "Interni uzivatele ctou dochazku" on public.dochazka_zakazky;
create policy "Interni uzivatele ctou dochazku"
on public.dochazka_zakazky
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.aktivni, true) = true
      and p.role in ('admin', 'sef', 'skladnik', 'hdt')
  )
);

-- ---------------------------------------------------------------------------
-- 3) Jádrové tabulky bez RLS – zapnout read pro interní role, write bez HDT
-- ---------------------------------------------------------------------------

alter table public.zakazky enable row level security;
alter table public.skladove_polozky enable row level security;
alter table public.sklad_polozky_kusy enable row level security;
alter table public.technika_na_zakazce enable row level security;
alter table public.zakazka_kusy enable row level security;
alter table public.sklad_kus_historie enable row level security;
alter table public.zakazka_lide enable row level security;
alter table public.zakazka_realizace enable row level security;
alter table public.klienti enable row level security;
alter table public.mista_konani enable row level security;
alter table public.setupy enable row level security;
alter table public.setup_polozky enable row level security;
alter table public.zakazka_client_links enable row level security;
alter table public.zakazka_dotazniky enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'hlaseni_poskozeni',
    'sklad_bloky',
    'kategorie_techniky',
    'podkategorie_techniky',
    'jednotky_skladu',
    'typy_poskozeni',
    'priority_poskozeni'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end;
$$;

-- Zakázky
drop policy if exists "Interni ctou zakazky" on public.zakazky;
drop policy if exists "Operational zapisuji zakazky" on public.zakazky;
create policy "Interni ctou zakazky"
on public.zakazky for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji zakazky"
on public.zakazky for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational upravuji zakazky"
on public.zakazky for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Operational mazaji zakazky"
on public.zakazky for delete to authenticated
using (public.is_operational_write_user());

-- Sklad
drop policy if exists "Interni ctou skladove polozky" on public.skladove_polozky;
drop policy if exists "Operational zapisuji skladove polozky" on public.skladove_polozky;
create policy "Interni ctou skladove polozky"
on public.skladove_polozky for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji skladove polozky"
on public.skladove_polozky for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational upravuji skladove polozky"
on public.skladove_polozky for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Operational mazaji skladove polozky"
on public.skladove_polozky for delete to authenticated
using (public.is_operational_write_user());

drop policy if exists "Interni ctou sklad kusy" on public.sklad_polozky_kusy;
drop policy if exists "Operational zapisuji sklad kusy" on public.sklad_polozky_kusy;
create policy "Interni ctou sklad kusy"
on public.sklad_polozky_kusy for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji sklad kusy"
on public.sklad_polozky_kusy for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational upravuji sklad kusy"
on public.sklad_polozky_kusy for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Operational mazaji sklad kusy"
on public.sklad_polozky_kusy for delete to authenticated
using (public.is_operational_write_user());

drop policy if exists "Interni ctou sklad historii" on public.sklad_kus_historie;
drop policy if exists "Operational zapisuji sklad historii" on public.sklad_kus_historie;
create policy "Interni ctou sklad historii"
on public.sklad_kus_historie for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji sklad historii"
on public.sklad_kus_historie for insert to authenticated
with check (public.is_operational_write_user());

-- Technika / scan / nakládka
drop policy if exists "Interni ctou techniku na zakazce" on public.technika_na_zakazce;
drop policy if exists "Operational zapisuji techniku na zakazce" on public.technika_na_zakazce;
create policy "Interni ctou techniku na zakazce"
on public.technika_na_zakazce for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji techniku na zakazce"
on public.technika_na_zakazce for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational upravuji techniku na zakazce"
on public.technika_na_zakazce for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Operational mazaji techniku na zakazce"
on public.technika_na_zakazce for delete to authenticated
using (public.is_operational_write_user());

drop policy if exists "Interni ctou zakazka kusy" on public.zakazka_kusy;
drop policy if exists "Operational zapisuji zakazka kusy" on public.zakazka_kusy;
create policy "Interni ctou zakazka kusy"
on public.zakazka_kusy for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji zakazka kusy"
on public.zakazka_kusy for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational upravuji zakazka kusy"
on public.zakazka_kusy for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Operational mazaji zakazka kusy"
on public.zakazka_kusy for delete to authenticated
using (public.is_operational_write_user());

-- Lidé na zakázce (read interní; write operational nebo vlastní potvrzení)
drop policy if exists "Interni ctou zakazka lide" on public.zakazka_lide;
drop policy if exists "Operational zapisuji zakazka lide" on public.zakazka_lide;
drop policy if exists "Zamestnanec upravuje vlastni prirazeni" on public.zakazka_lide;
create policy "Interni ctou zakazka lide"
on public.zakazka_lide for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji zakazka lide"
on public.zakazka_lide for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational mazaji zakazka lide"
on public.zakazka_lide for delete to authenticated
using (public.is_operational_write_user());
create policy "Operational upravuji zakazka lide"
on public.zakazka_lide for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Zamestnanec upravuje vlastni prirazeni"
on public.zakazka_lide for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Realizace, klienti, místa, dotazníky (read-only pro HDT)
drop policy if exists "Interni ctou zakazka realizace" on public.zakazka_realizace;
drop policy if exists "Operational zapisuji zakazka realizace" on public.zakazka_realizace;
create policy "Interni ctou zakazka realizace"
on public.zakazka_realizace for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji zakazka realizace"
on public.zakazka_realizace for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational upravuji zakazka realizace"
on public.zakazka_realizace for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Operational mazaji zakazka realizace"
on public.zakazka_realizace for delete to authenticated
using (public.is_operational_write_user());

drop policy if exists "Interni ctou klienty" on public.klienti;
drop policy if exists "Operational zapisuji klienty" on public.klienti;
create policy "Interni ctou klienty"
on public.klienti for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji klienty"
on public.klienti for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational upravuji klienty"
on public.klienti for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Operational mazaji klienty"
on public.klienti for delete to authenticated
using (public.is_operational_write_user());

drop policy if exists "Interni ctou mista" on public.mista_konani;
drop policy if exists "Operational zapisuji mista" on public.mista_konani;
create policy "Interni ctou mista"
on public.mista_konani for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji mista"
on public.mista_konani for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational upravuji mista"
on public.mista_konani for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Operational mazaji mista"
on public.mista_konani for delete to authenticated
using (public.is_operational_write_user());

drop policy if exists "Interni ctou setupy" on public.setupy;
drop policy if exists "Operational zapisuji setupy" on public.setupy;
create policy "Interni ctou setupy"
on public.setupy for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji setupy"
on public.setupy for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational upravuji setupy"
on public.setupy for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Operational mazaji setupy"
on public.setupy for delete to authenticated
using (public.is_operational_write_user());

drop policy if exists "Interni ctou setup polozky" on public.setup_polozky;
drop policy if exists "Operational zapisuji setup polozky" on public.setup_polozky;
create policy "Interni ctou setup polozky"
on public.setup_polozky for select to authenticated
using (public.is_active_internal_reader());
create policy "Operational zapisuji setup polozky"
on public.setup_polozky for insert to authenticated
with check (public.is_operational_write_user());
create policy "Operational upravuji setup polozky"
on public.setup_polozky for update to authenticated
using (public.is_operational_write_user())
with check (public.is_operational_write_user());
create policy "Operational mazaji setup polozky"
on public.setup_polozky for delete to authenticated
using (public.is_operational_write_user());

drop policy if exists "Interni ctou client links" on public.zakazka_client_links;
drop policy if exists "Interni spravuji client links" on public.zakazka_client_links;
create policy "Interni ctou client links"
on public.zakazka_client_links for select to authenticated
using (public.is_active_internal_reader());
create policy "Interni vkladaji client links"
on public.zakazka_client_links for insert to authenticated
with check (public.is_internal_write_excluding_hdt());
create policy "Interni upravuji client links"
on public.zakazka_client_links for update to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());
create policy "Interni mazaji client links"
on public.zakazka_client_links for delete to authenticated
using (public.is_internal_write_excluding_hdt());

drop policy if exists "Interni ctou dotazniky" on public.zakazka_dotazniky;
drop policy if exists "Interni spravuji dotazniky" on public.zakazka_dotazniky;
create policy "Interni ctou dotazniky"
on public.zakazka_dotazniky for select to authenticated
using (public.is_active_internal_reader());
create policy "Interni vkladaji dotazniky"
on public.zakazka_dotazniky for insert to authenticated
with check (public.is_internal_write_excluding_hdt());
create policy "Interni upravuji dotazniky"
on public.zakazka_dotazniky for update to authenticated
using (public.is_internal_write_excluding_hdt())
with check (public.is_internal_write_excluding_hdt());
create policy "Interni mazaji dotazniky"
on public.zakazka_dotazniky for delete to authenticated
using (public.is_internal_write_excluding_hdt());

-- Volitelné skladové číselníky (pokud tabulka existuje)
do $$
declare
  t text;
begin
  foreach t in array array[
    'hlaseni_poskozeni',
    'sklad_bloky',
    'kategorie_techniky',
    'podkategorie_techniky',
    'jednotky_skladu',
    'typy_poskozeni',
    'priority_poskozeni'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('drop policy if exists %L on public.%I', 'Interni ctou ' || t, t);
      execute format('drop policy if exists %L on public.%I', 'Operational zapisuji ' || t, t);
      execute format('drop policy if exists %L on public.%I', 'Operational upravuji ' || t, t);
      execute format('drop policy if exists %L on public.%I', 'Operational mazaji ' || t, t);
      execute format(
        'create policy %L on public.%I for select to authenticated using (public.is_active_internal_reader())',
        'Interni ctou ' || t,
        t
      );
      execute format(
        'create policy %L on public.%I for insert to authenticated with check (public.is_operational_write_user())',
        'Operational zapisuji ' || t,
        t
      );
      execute format(
        'create policy %L on public.%I for update to authenticated using (public.is_operational_write_user()) with check (public.is_operational_write_user())',
        'Operational upravuji ' || t,
        t
      );
      execute format(
        'create policy %L on public.%I for delete to authenticated using (public.is_operational_write_user())',
        'Operational mazaji ' || t,
        t
      );
    end if;
  end loop;
end;
$$;

-- technicky_vlastnici: SELECT už je pro všechny authenticated; write zůstává admin/sef/skladnik
drop policy if exists "Interni uzivatele ctou technicke vlastniky" on public.technicky_vlastnici;
create policy "Interni uzivatele ctou technicke vlastniky"
on public.technicky_vlastnici
for select
to authenticated
using (public.is_active_internal_reader());

-- sklad_odpisova_pasma: SELECT pro interní; write už omezen operational rolemi
drop policy if exists "Interni uzivatele ctou odpisova pasma" on public.sklad_odpisova_pasma;
create policy "Interni uzivatele ctou odpisova pasma"
on public.sklad_odpisova_pasma
for select
to authenticated
using (public.is_active_internal_reader());

-- ---------------------------------------------------------------------------
-- 4) SECURITY DEFINER RPC – explicitní blokace HDT
-- ---------------------------------------------------------------------------

create or replace function public.create_zakazka_atomic(
  zakazka_payload jsonb,
  misto_payload jsonb default null,
  realizace_payload jsonb default '[]'::jsonb,
  technika_payload jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zakazka_id uuid;
  v_misto_id uuid;
  v_zakazka_payload jsonb := zakazka_payload;
begin
  perform public.assert_internal_write_allowed();

  if not public.is_operational_write_user() then
    raise exception 'FORBIDDEN';
  end if;

  if misto_payload is not null and misto_payload <> '{}'::jsonb then
    insert into public.mista_konani (
      klient_id,
      nazev,
      adresa_text,
      lat,
      lng,
      radius_m
    )
    select
      klient_id,
      nazev,
      adresa_text,
      lat,
      lng,
      radius_m
    from jsonb_to_record(misto_payload) as x(
      klient_id uuid,
      nazev text,
      adresa_text text,
      lat numeric,
      lng numeric,
      radius_m integer
    )
    returning misto_id into v_misto_id;

    v_zakazka_payload := jsonb_set(v_zakazka_payload, '{misto_id}', to_jsonb(v_misto_id), true);
  end if;

  insert into public.zakazky (
    cislo_zakazky,
    stav_zakazky_id,
    nazev,
    klient_id,
    fakturacni_firma_id,
    misto_id,
    misto,
    misto_lat,
    misto_lng,
    misto_gps_radius_m,
    misto_gps_presnost_m,
    misto_gps_zdroj,
    misto_gps_updated_at,
    typ_obsluhy,
    odjezd_ze_skladu,
    sraz_na_miste,
    stavba_od,
    stavba_do,
    akce_od,
    akce_do,
    bourani_od,
    bourani_do,
    datum_od,
    datum_do,
    cas_od,
    cas_do,
    stage_preset,
    stage_width_m,
    stage_depth_m,
    sound_preset,
    lights_preset,
    led_kind,
    led_width_m,
    led_height_m,
    led_requested_area_m2,
    led_wall_rohy,
    led_is_mantel,
    kamery_count,
    dron,
    poznamka
  )
  select
    cislo_zakazky,
    stav_zakazky_id,
    nazev,
    klient_id,
    fakturacni_firma_id,
    misto_id,
    misto,
    misto_lat,
    misto_lng,
    misto_gps_radius_m,
    misto_gps_presnost_m,
    misto_gps_zdroj,
    misto_gps_updated_at,
    typ_obsluhy,
    odjezd_ze_skladu,
    sraz_na_miste,
    stavba_od,
    stavba_do,
    akce_od,
    akce_do,
    bourani_od,
    bourani_do,
    datum_od,
    datum_do,
    cas_od,
    cas_do,
    stage_preset,
    stage_width_m,
    stage_depth_m,
    sound_preset,
    lights_preset,
    led_kind,
    led_width_m,
    led_height_m,
    led_requested_area_m2,
    led_wall_rohy,
    led_is_mantel,
    kamery_count,
    dron,
    poznamka
  from jsonb_to_record(v_zakazka_payload) as x(
    cislo_zakazky text,
    stav_zakazky_id uuid,
    nazev text,
    klient_id uuid,
    fakturacni_firma_id uuid,
    misto_id uuid,
    misto text,
    misto_lat numeric,
    misto_lng numeric,
    misto_gps_radius_m integer,
    misto_gps_presnost_m numeric,
    misto_gps_zdroj text,
    misto_gps_updated_at timestamptz,
    typ_obsluhy text,
    odjezd_ze_skladu timestamptz,
    sraz_na_miste timestamptz,
    stavba_od timestamptz,
    stavba_do timestamptz,
    akce_od timestamptz,
    akce_do timestamptz,
    bourani_od timestamptz,
    bourani_do timestamptz,
    datum_od date,
    datum_do date,
    cas_od time,
    cas_do time,
    stage_preset text,
    stage_width_m numeric,
    stage_depth_m numeric,
    sound_preset text,
    lights_preset text,
    led_kind text,
    led_width_m numeric,
    led_height_m numeric,
    led_requested_area_m2 numeric,
    led_wall_rohy boolean,
    led_is_mantel boolean,
    kamery_count integer,
    dron boolean,
    poznamka text
  )
  returning zakazka_id into v_zakazka_id;

  if jsonb_typeof(realizace_payload) = 'array' and jsonb_array_length(realizace_payload) > 0 then
    insert into public.zakazka_realizace (
      zakazka_id,
      nazev,
      poradi,
      stage_typ,
      stage_sirka,
      stage_hloubka,
      sound_typ,
      lights_typ,
      led_typ,
      led_sirka,
      led_vyska,
      led_rohy,
      kamery,
      dron
    )
    select
      v_zakazka_id,
      nazev,
      poradi,
      stage_typ,
      stage_sirka,
      stage_hloubka,
      sound_typ,
      lights_typ,
      led_typ,
      led_sirka,
      led_vyska,
      led_rohy,
      kamery,
      dron
    from jsonb_to_recordset(realizace_payload) as x(
      nazev text,
      poradi integer,
      stage_typ text,
      stage_sirka numeric,
      stage_hloubka numeric,
      sound_typ text,
      lights_typ text,
      led_typ text,
      led_sirka numeric,
      led_vyska numeric,
      led_rohy boolean,
      kamery integer,
      dron boolean
    );
  end if;

  if jsonb_typeof(technika_payload) = 'array' and jsonb_array_length(technika_payload) > 0 then
    insert into public.technika_na_zakazce (
      zakazka_id,
      skladova_polozka_id,
      mnozstvi
    )
    select
      v_zakazka_id,
      skladova_polozka_id,
      mnozstvi
    from jsonb_to_recordset(technika_payload) as x(
      skladova_polozka_id uuid,
      mnozstvi integer
    );
  end if;

  return v_zakazka_id;
end;
$$;

grant execute on function public.create_zakazka_atomic(jsonb, jsonb, jsonb, jsonb) to authenticated;

-- update_skladova_polozka_vlastnik: write už omezen na admin/sef/skladnik (HDT neprojde).
-- update_user_role / whitelist RPC: admin-only (beze změny).
--
-- Poznámka: skladové write RPC (create_skladova_polozka, update_skladova_polozka*, …)
-- nejsou v repozitáři migrací – po nasazení RLS na tabulky blokují přímý zápis HDT;
-- u SECURITY DEFINER RPC bez role checku je potřeba doplnit perform public.assert_internal_write_allowed()
-- při další úpravě jejich definice v DB.
