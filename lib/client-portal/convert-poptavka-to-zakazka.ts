import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { combineDateAndTime } from "@/app/zakazky/[id]/helpers";
import { formatTypAkce } from "@/lib/client-portal/poptavka-form";
import {
  buildDotaznikPayloadFromSnapshot,
  buildZakazkaFieldsFromSnapshot,
  snapshotSetupRows,
} from "@/lib/client-portal/convert-poptavka-snapshot";
import { buildTechnikaPayloadFromSetupRows } from "@/lib/client-portal/convert-poptavka-technika";
import type { InternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import { loadInternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import { loadConfirmedPoptavkaObjednavkaLink } from "@/lib/client-portal/poptavka-objednavka-link-server";
import type { PoptavkaStav } from "@/lib/client-portal/types";

const DEFAULT_STAV_ZAKAZKY_ID = "7a0e168f-216f-40bd-b33e-3f1f517620da";

export type ConvertPoptavkaError =
  | "not_found"
  | "invalid_state"
  | "missing_klient"
  | "missing_akce_datum"
  | "create_failed"
  | "link_failed"
  | "missing_confirmed_snapshot"
  | "invalid_confirmed_snapshot"
  | "snapshot_poptavka_mismatch"
  | "setup_not_found"
  | "setup_empty";

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

type ConvertMode = "legacy" | "snapshot";

function deriveLegacyDate(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function deriveLegacyTime(value: string | null) {
  return value ? value.slice(11, 16) : null;
}

function normalizeTime(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  return trimmed;
}

function resolveConvertMode(detail: InternalPoptavkaDetail): ConvertMode {
  return detail.objednavka_potvrzena_at ? "snapshot" : "legacy";
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
    lines.push(
      `Typ akce: ${formatTypAkce(detail.typ_akce)}${detail.typ_akce_poznamka ? ` — ${detail.typ_akce_poznamka}` : ""}`
    );
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

type MistoSearchHint = {
  nazev?: string | null;
  adresa?: string | null;
};

async function resolveMistoId(
  supabase: SupabaseClient,
  detail: InternalPoptavkaDetail,
  search?: MistoSearchHint
): Promise<string | null> {
  if (detail.misto_id && detail.klient_id) {
    const { data } = await supabase
      .from("mista_konani")
      .select("misto_id, klient_id")
      .eq("misto_id", detail.misto_id)
      .maybeSingle();

    if (data?.misto_id && data.klient_id === detail.klient_id) {
      return data.misto_id as string;
    }
  }

  const searchName = search?.nazev?.trim() || detail.misto_nazev?.trim();
  const searchAddress = search?.adresa?.trim() || detail.misto_adresa?.trim();

  if (!searchName && !searchAddress) {
    return null;
  }

  if (searchName && detail.klient_id) {
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

  if (searchAddress && detail.klient_id) {
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

type ZakazkaCreateInput = {
  nazev: string;
  mistoText: string | null;
  mistoId: string | null;
  mistoLat: number | null;
  mistoLng: number | null;
  mistoPayload: {
    klient_id: string;
    nazev: string;
    adresa_text: string;
    lat: number;
    lng: number;
    radius_m: number;
  } | null;
  akceOd: string;
  akceDo: string;
  stavbaOd: string | null;
  stavbaDo: string | null;
  bouraniOd: string | null;
  bouraniDo: string | null;
  poznamka: string | null;
  technikaPayload: { skladova_polozka_id: string; mnozstvi: number }[];
  buildDotaznik: (zakazkaId: string) => Record<string, unknown>;
};

type BuildZakazkaInputResult =
  | { ok: false; error: ConvertPoptavkaError; message?: string }
  | { ok: true; input: ZakazkaCreateInput };

async function buildLegacyZakazkaCreateInput(
  supabase: SupabaseClient,
  detail: InternalPoptavkaDetail
): Promise<BuildZakazkaInputResult> {
  const { akceOd, akceDo } = combineAkceRange(detail);
  if (!akceOd || !akceDo) {
    return { ok: false, error: "missing_akce_datum" };
  }

  const technikaResult =
    detail.setupy.length === 0
      ? { ok: true as const, payload: [] }
      : await buildTechnikaPayloadFromSetupRows(
          supabase,
          detail.setupy.map((row) => ({
            setupId: row.setup_id,
            mnozstvi: row.mnozstvi,
          }))
        );

  if (!technikaResult.ok) {
    return { ok: false, error: technikaResult.error, message: technikaResult.message };
  }

  const stavbaOd = combineDateAndTime(detail.stavba_datum, normalizeTime(detail.stavba_cas_od));
  const stavbaDo = combineDateAndTime(detail.stavba_datum, normalizeTime(detail.stavba_cas_do));
  const bouraniOd = combineDateAndTime(detail.bourani_datum, normalizeTime(detail.bourani_cas_od));
  const bouraniDo = combineDateAndTime(detail.bourani_datum, normalizeTime(detail.bourani_cas_do));

  const mistoText = detail.misto_adresa?.trim() || detail.misto_nazev?.trim() || null;
  const nazev = detail.misto_nazev?.trim() || detail.misto_adresa?.trim() || detail.cislo_poptavky;

  const mistoId = await resolveMistoId(supabase, detail);
  const mistoLat = detail.misto_lat != null ? Number(detail.misto_lat) : null;
  const mistoLng = detail.misto_lng != null ? Number(detail.misto_lng) : null;

  const mistoPayload =
    !mistoId && mistoLat != null && mistoLng != null && detail.klient_id
      ? {
          klient_id: detail.klient_id,
          nazev: detail.misto_nazev?.trim() || mistoText || nazev,
          adresa_text: detail.misto_adresa?.trim() || mistoText || nazev,
          lat: mistoLat,
          lng: mistoLng,
          radius_m: 300,
        }
      : null;

  return {
    ok: true,
    input: {
      nazev,
      mistoText,
      mistoId,
      mistoLat,
      mistoLng,
      mistoPayload,
      akceOd,
      akceDo,
      stavbaOd,
      stavbaDo,
      bouraniOd,
      bouraniDo,
      poznamka: buildPoznamka(detail) || null,
      technikaPayload: technikaResult.payload,
      buildDotaznik: (zakazkaId) => buildDotaznikPayload(detail, zakazkaId),
    },
  };
}

async function buildSnapshotZakazkaCreateInput(
  supabase: SupabaseClient,
  detail: InternalPoptavkaDetail
): Promise<BuildZakazkaInputResult> {
  const confirmed = await loadConfirmedPoptavkaObjednavkaLink(supabase, detail.poptavka_id);

  if (!confirmed.ok) {
    if (confirmed.error === "not_found") {
      return { ok: false, error: "missing_confirmed_snapshot" };
    }
    return { ok: false, error: confirmed.error };
  }

  const { snapshot } = confirmed;
  const fields = buildZakazkaFieldsFromSnapshot(snapshot, detail);

  if ("error" in fields) {
    return { ok: false, error: fields.error };
  }

  const technikaResult = await buildTechnikaPayloadFromSetupRows(
    supabase,
    snapshotSetupRows(snapshot)
  );

  if (!technikaResult.ok) {
    return { ok: false, error: technikaResult.error, message: technikaResult.message };
  }

  const mistoId = await resolveMistoId(supabase, detail, {
    nazev: snapshot.misto.nazev,
    adresa: snapshot.misto.adresa,
  });

  const mistoLat = fields.mistoLat;
  const mistoLng = fields.mistoLng;

  const mistoPayload =
    !mistoId && mistoLat != null && mistoLng != null && detail.klient_id
      ? {
          klient_id: detail.klient_id,
          nazev: snapshot.misto.nazev?.trim() || fields.nazev,
          adresa_text:
            snapshot.misto.adresa?.trim() || fields.mistoText || snapshot.misto.nazev?.trim() || fields.nazev,
          lat: mistoLat,
          lng: mistoLng,
          radius_m: 300,
        }
      : null;

  return {
    ok: true,
    input: {
      nazev: fields.nazev,
      mistoText: fields.mistoText,
      mistoId,
      mistoLat,
      mistoLng,
      mistoPayload,
      akceOd: fields.akceOd,
      akceDo: fields.akceDo,
      stavbaOd: fields.stavbaOd,
      stavbaDo: fields.stavbaDo,
      bouraniOd: fields.bouraniOd,
      bouraniDo: fields.bouraniDo,
      poznamka: fields.poznamka || null,
      technikaPayload: technikaResult.payload,
      buildDotaznik: (zakazkaId) => buildDotaznikPayloadFromSnapshot(snapshot, detail, zakazkaId),
    },
  };
}

async function createZakazkaFromInput(
  supabase: SupabaseClient,
  poptavkaId: string,
  detail: InternalPoptavkaDetail,
  input: ZakazkaCreateInput
): Promise<ConvertPoptavkaResult> {
  const cisloZakazky = await generateCisloZakazky(supabase);

  const { data: zakazkaId, error: createError } = await supabase.rpc("create_zakazka_atomic", {
    misto_payload: input.mistoPayload,
    realizace_payload: [],
    technika_payload: input.technikaPayload,
    zakazka_payload: {
      cislo_zakazky: cisloZakazky,
      stav_zakazky_id: DEFAULT_STAV_ZAKAZKY_ID,
      nazev: input.nazev,
      klient_id: detail.klient_id,
      fakturacni_firma_id: null,
      misto_id: input.mistoId,
      misto: input.mistoText,
      misto_lat: input.mistoLat,
      misto_lng: input.mistoLng,
      misto_gps_radius_m: input.mistoLat != null && input.mistoLng != null ? 300 : null,
      misto_gps_presnost_m: null,
      misto_gps_zdroj: input.mistoLat != null && input.mistoLng != null ? "poptavka" : null,
      misto_gps_updated_at:
        input.mistoLat != null && input.mistoLng != null ? new Date().toISOString() : null,
      typ_obsluhy: "s_obsluhou",
      odjezd_ze_skladu: null,
      sraz_na_miste: null,
      stavba_od: input.stavbaOd,
      stavba_do: input.stavbaDo,
      akce_od: input.akceOd,
      akce_do: input.akceDo,
      bourani_od: input.bouraniOd,
      bourani_do: input.bouraniDo,
      datum_od: deriveLegacyDate(input.akceOd),
      datum_do: deriveLegacyDate(input.akceDo),
      cas_od: deriveLegacyTime(input.akceOd),
      cas_do: deriveLegacyTime(input.akceDo),
      poznamka: input.poznamka,
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

  const dotaznikPayload = input.buildDotaznik(createdZakazkaId);
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

  const mode = resolveConvertMode(detail);
  const built =
    mode === "snapshot"
      ? await buildSnapshotZakazkaCreateInput(supabase, detail)
      : await buildLegacyZakazkaCreateInput(supabase, detail);

  if (!built.ok) {
    return built;
  }

  return createZakazkaFromInput(supabase, poptavkaId, detail, built.input);
}
