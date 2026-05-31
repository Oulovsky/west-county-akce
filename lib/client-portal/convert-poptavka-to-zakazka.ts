import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { combineDateAndTime } from "@/app/zakazky/[id]/helpers";
import { formatTypAkce } from "@/lib/client-portal/poptavka-form";
import type { InternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import { loadInternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import type { PoptavkaStav } from "@/lib/client-portal/types";

const DEFAULT_STAV_ZAKAZKY_ID = "7a0e168f-216f-40bd-b33e-3f1f517620da";

export type ConvertPoptavkaError =
  | "not_found"
  | "invalid_state"
  | "missing_klient"
  | "missing_akce_datum"
  | "create_failed"
  | "link_failed";

export type ConvertPoptavkaResult =
  | {
      ok: true;
      zakazkaId: string;
      alreadyConverted: boolean;
    }
  | {
      ok: false;
      error: ConvertPoptavkaError;
      message?: string;
    };

function deriveLegacyDate(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function deriveLegacyTime(value: string | null) {
  return value ? value.slice(11, 16) : null;
}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeTime(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  return trimmed;
}

function combineAkceRange(detail: InternalPoptavkaDetail) {
  const dateFrom = detail.datum_od;
  const dateTo = detail.datum_do ?? detail.datum_od;
  const timeFrom = normalizeTime(detail.cas_programu_od) ?? "08:00";
  const timeTo = normalizeTime(detail.cas_programu_do) ?? timeFrom;

  const akceOd = dateFrom ? combineDateAndTime(dateFrom, timeFrom) : null;
  const akceDo = dateTo ? combineDateAndTime(dateTo, timeTo) : null;

  return { akceOd, akceDo };
}

function buildPoznamka(detail: InternalPoptavkaDetail) {
  const lines: string[] = [`Převzato z poptávky ${detail.cislo_poptavky}.`];

  if (detail.typ_akce) {
    lines.push(`Typ akce: ${formatTypAkce(detail.typ_akce)}${detail.typ_akce_poznamka ? ` — ${detail.typ_akce_poznamka}` : ""}`);
  } else if (detail.typ_akce_poznamka) {
    lines.push(`Typ akce: ${detail.typ_akce_poznamka}`);
  }

  if (detail.misto_poznamka) {
    lines.push(`Poznámka k místu: ${detail.misto_poznamka}`);
  }

  if (detail.stavba_poznamka || detail.stavba_omezeni_vjezdu || detail.stavba_pristup_od) {
    lines.push(
      [
        detail.stavba_pristup_od ? `Stavba — přístup od: ${detail.stavba_pristup_od}` : null,
        detail.stavba_omezeni_vjezdu ? `Omezení vjezdu: ${detail.stavba_omezeni_vjezdu}` : null,
        detail.stavba_poznamka ? `Stavba: ${detail.stavba_poznamka}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (detail.bourani_poznamka || detail.bourani_misto_uvolneno_do) {
    lines.push(
      [
        detail.bourani_misto_uvolneno_do
          ? `Bourání — místo uvolněno do: ${detail.bourani_misto_uvolneno_do}`
          : null,
        detail.bourani_poznamka ? `Bourání: ${detail.bourani_poznamka}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (detail.interni_poznamka) {
    lines.push(`Interní poznámka k poptávce: ${detail.interni_poznamka}`);
  }

  const setupNotes = detail.setupy
    .map((row) => (row.poznamka_klienta ? `${row.setup.nazev}: ${row.poznamka_klienta}` : null))
    .filter(Boolean);

  if (setupNotes.length > 0) {
    lines.push(`Poznámky ke setupům:\n${setupNotes.join("\n")}`);
  }

  return lines.filter(Boolean).join("\n\n");
}

async function generateCisloZakazky(supabase: SupabaseClient) {
  const rok = new Date().getFullYear();

  const { data, error } = await supabase
    .from("zakazky")
    .select("cislo_zakazky")
    .like("cislo_zakazky", `${rok}/%`)
    .order("cislo_zakazky", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  let dalsiPoradi = 1;

  if (data && data.length > 0) {
    const posledni = data[0].cislo_zakazky as string;
    const casti = posledni.split("/");
    const posledniPoradi = parseInt(casti[1], 10);
    if (!Number.isNaN(posledniPoradi)) {
      dalsiPoradi = posledniPoradi + 1;
    }
  }

  return `${rok}/${String(dalsiPoradi).padStart(3, "0")}`;
}

async function resolveMistoId(
  supabase: SupabaseClient,
  detail: InternalPoptavkaDetail
): Promise<string | null> {
  if (detail.misto_id) {
    const { data } = await supabase
      .from("mista_konani")
      .select("misto_id")
      .eq("misto_id", detail.misto_id)
      .maybeSingle();

    if (data?.misto_id) {
      return data.misto_id as string;
    }
  }

  const searchName = detail.misto_nazev?.trim();
  const searchAddress = detail.misto_adresa?.trim();

  if (!searchName && !searchAddress) {
    return null;
  }

  if (searchName) {
    const { data: byName } = await supabase
      .from("mista_konani")
      .select("misto_id")
      .eq("klient_id", detail.klient_id)
      .ilike("nazev", searchName)
      .limit(1)
      .maybeSingle();

    if (byName?.misto_id) {
      return byName.misto_id as string;
    }
  }

  if (searchAddress) {
    const { data: byAddress } = await supabase
      .from("mista_konani")
      .select("misto_id")
      .eq("klient_id", detail.klient_id)
      .ilike("adresa_text", searchAddress)
      .limit(1)
      .maybeSingle();

    if (byAddress?.misto_id) {
      return byAddress.misto_id as string;
    }
  }

  return null;
}

async function buildTechnikaPayload(
  supabase: SupabaseClient,
  detail: InternalPoptavkaDetail
) {
  if (detail.setupy.length === 0) {
    return [];
  }

  const setupIds = detail.setupy.map((row) => row.setup_id);
  const { data: polozkyRaw, error } = await supabase
    .from("setup_polozky")
    .select("setup_id, skladova_polozka_id, mnozstvi")
    .in("setup_id", setupIds);

  if (error) {
    throw new Error(error.message);
  }

  const aggregated = new Map<string, number>();

  for (const setupRow of detail.setupy) {
    const setupQuantity = toNumber(setupRow.mnozstvi);
    if (setupQuantity <= 0) continue;

    for (const polozka of polozkyRaw ?? []) {
      if (polozka.setup_id !== setupRow.setup_id) continue;

      const itemQuantity = toNumber(polozka.mnozstvi);
      if (itemQuantity <= 0) continue;

      const total = itemQuantity * setupQuantity;
      aggregated.set(
        polozka.skladova_polozka_id as string,
        (aggregated.get(polozka.skladova_polozka_id as string) ?? 0) + total
      );
    }
  }

  return [...aggregated.entries()].map(([skladova_polozka_id, mnozstvi]) => ({
    skladova_polozka_id,
    mnozstvi: Math.max(1, Math.round(mnozstvi)),
  }));
}

function buildDotaznikPayload(detail: InternalPoptavkaDetail, zakazkaId: string) {
  const technika = detail.technicke_udaje;
  const extra = technika?.odpovedi_extra ?? {};
  const now = new Date().toISOString();

  return {
    zakazka_id: zakazkaId,
    link_id: null,
    stav: technika?.pozadovan_vyjezd_technika ? "pozadovan_vyjezd_technika" : "prevzato_z_poptavky",
    kontakt_jmeno: detail.kontakt_jmeno,
    kontakt_telefon: detail.kontakt_telefon,
    prijezd_poznamka: technika?.prijezd_poznamka ?? null,
    parkovani_poznamka: technika?.parkovani_poznamka ?? null,
    elektro_pripojka: technika?.elektro_pripojka ?? null,
    elektro_jisteni: technika?.elektro_jisteni ?? null,
    elektro_zasuvka: technika?.elektro_zasuvka ?? null,
    elektro_vzdalenost_m: technika?.elektro_vzdalenost_m ?? null,
    pozadovan_vyjezd_technika: technika?.pozadovan_vyjezd_technika ?? false,
    potvrzeni_pravdivosti: false,
    potvrzeni_doctovani: false,
    rizika: technika?.rizika ?? [],
    odpovedi_extra: {
      ...extra,
      zdroj: "poptavka",
      poptavka_id: detail.poptavka_id,
      cislo_poptavky: detail.cislo_poptavky,
      rozvadece_poznamka: technika?.rozvadece_poznamka ?? null,
      kabelove_trasy: technika?.kabelove_trasy ?? null,
      misto_stage: technika?.misto_stage ?? null,
      misto_foh: technika?.misto_foh ?? null,
      omezeni_hluku: technika?.omezeni_hluku ?? null,
      casova_omezeni: technika?.casova_omezeni ?? null,
      dalsi_poznamky: technika?.dalsi_poznamky ?? null,
      kontakt_email: detail.kontakt_email,
    },
    submitted_at: technika ? now : null,
    updated_at: now,
  };
}

export function canConvertPoptavkaToZakazka(detail: {
  stav: PoptavkaStav;
  zakazka_id: string | null;
}) {
  return detail.stav === "schvalena" && detail.zakazka_id == null;
}

export async function convertPoptavkaToZakazka(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<ConvertPoptavkaResult> {
  const detail = await loadInternalPoptavkaDetail(supabase, poptavkaId);

  if (!detail) {
    return { ok: false, error: "not_found" };
  }

  if (detail.zakazka_id) {
    return { ok: true, zakazkaId: detail.zakazka_id, alreadyConverted: true };
  }

  if (detail.stav !== "schvalena") {
    return { ok: false, error: "invalid_state" };
  }

  const { data: existingBySource } = await supabase
    .from("zakazky")
    .select("zakazka_id")
    .eq("zdroj_poptavka_id", poptavkaId)
    .maybeSingle();

  if (existingBySource?.zakazka_id) {
    await supabase
      .from("poptavky")
      .update({
        zakazka_id: existingBySource.zakazka_id,
        stav: "prevadena_do_zakazky",
        updated_at: new Date().toISOString(),
      })
      .eq("poptavka_id", poptavkaId)
      .is("zakazka_id", null);

    return {
      ok: true,
      zakazkaId: existingBySource.zakazka_id as string,
      alreadyConverted: true,
    };
  }

  if (!detail.klient_id) {
    return { ok: false, error: "missing_klient" };
  }

  const { akceOd, akceDo } = combineAkceRange(detail);
  if (!akceOd || !akceDo) {
    return { ok: false, error: "missing_akce_datum" };
  }

  const stavbaOd = combineDateAndTime(
    detail.stavba_datum,
    normalizeTime(detail.stavba_cas_od)
  );
  const stavbaDo = combineDateAndTime(
    detail.stavba_datum,
    normalizeTime(detail.stavba_cas_do)
  );
  const bouraniOd = combineDateAndTime(
    detail.bourani_datum,
    normalizeTime(detail.bourani_cas_od)
  );
  const bouraniDo = combineDateAndTime(
    detail.bourani_datum,
    normalizeTime(detail.bourani_cas_do)
  );

  const mistoText = detail.misto_adresa?.trim() || detail.misto_nazev?.trim() || null;
  const nazev = detail.misto_nazev?.trim() || detail.misto_adresa?.trim() || detail.cislo_poptavky;

  let mistoId = await resolveMistoId(supabase, detail);
  const mistoLat = detail.misto_lat != null ? Number(detail.misto_lat) : null;
  const mistoLng = detail.misto_lng != null ? Number(detail.misto_lng) : null;

  const mistoPayload =
    !mistoId && mistoLat != null && mistoLng != null
      ? {
          klient_id: detail.klient_id,
          nazev: detail.misto_nazev?.trim() || mistoText || nazev,
          adresa_text: detail.misto_adresa?.trim() || mistoText || nazev,
          lat: mistoLat,
          lng: mistoLng,
          radius_m: 300,
        }
      : null;

  const technikaPayload = await buildTechnikaPayload(supabase, detail);
  const cisloZakazky = await generateCisloZakazky(supabase);

  const { data: zakazkaId, error: createError } = await supabase.rpc("create_zakazka_atomic", {
    misto_payload: mistoPayload,
    realizace_payload: [],
    technika_payload: technikaPayload,
    zakazka_payload: {
      cislo_zakazky: cisloZakazky,
      stav_zakazky_id: DEFAULT_STAV_ZAKAZKY_ID,
      nazev,
      klient_id: detail.klient_id,
      fakturacni_firma_id: null,
      misto_id: mistoId,
      misto: mistoText,
      misto_lat: mistoLat,
      misto_lng: mistoLng,
      misto_gps_radius_m: mistoLat != null && mistoLng != null ? 300 : null,
      misto_gps_presnost_m: null,
      misto_gps_zdroj: mistoLat != null && mistoLng != null ? "poptavka" : null,
      misto_gps_updated_at: mistoLat != null && mistoLng != null ? new Date().toISOString() : null,
      typ_obsluhy: "s_obsluhou",
      odjezd_ze_skladu: null,
      sraz_na_miste: null,
      stavba_od: stavbaOd,
      stavba_do: stavbaDo,
      akce_od: akceOd,
      akce_do: akceDo,
      bourani_od: bouraniOd,
      bourani_do: bouraniDo,
      datum_od: deriveLegacyDate(akceOd),
      datum_do: deriveLegacyDate(akceDo),
      cas_od: deriveLegacyTime(akceOd),
      cas_do: deriveLegacyTime(akceDo),
      poznamka: buildPoznamka(detail) || null,
    },
  });

  if (createError || !zakazkaId) {
    return {
      ok: false,
      error: "create_failed",
      message: createError?.message,
    };
  }

  const createdZakazkaId = zakazkaId as string;

  const { error: sourceLinkError } = await supabase
    .from("zakazky")
    .update({ zdroj_poptavka_id: poptavkaId })
    .eq("zakazka_id", createdZakazkaId)
    .is("zdroj_poptavka_id", null);

  if (sourceLinkError) {
    return { ok: false, error: "link_failed", message: sourceLinkError.message };
  }

  const dotaznikPayload = buildDotaznikPayload(detail, createdZakazkaId);
  const { error: dotaznikError } = await supabase.from("zakazka_dotazniky").insert(dotaznikPayload);

  if (dotaznikError) {
    return { ok: false, error: "link_failed", message: dotaznikError.message };
  }

  const now = new Date().toISOString();
  const { error: poptavkaUpdateError } = await supabase
    .from("poptavky")
    .update({
      zakazka_id: createdZakazkaId,
      stav: "prevadena_do_zakazky",
      updated_at: now,
    })
    .eq("poptavka_id", poptavkaId)
    .eq("stav", "schvalena")
    .is("zakazka_id", null);

  if (poptavkaUpdateError) {
    return { ok: false, error: "link_failed", message: poptavkaUpdateError.message };
  }

  return { ok: true, zakazkaId: createdZakazkaId, alreadyConverted: false };
}
