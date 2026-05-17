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
