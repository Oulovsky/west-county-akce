import { TYP_AKCE_OPTIONS } from "@/lib/client-portal/poptavka-form";
import { parseSestavaKonfiguratorJson } from "@/lib/client-portal/sestava-konfigurator-form";
import { parseTechnikaJson } from "@/lib/client-portal/poptavka-technika-form";
import type {
  ObjednavkaExtraPolozka,
  ObjednavkaPricingBlock,
  PoptavkaObjednavkaDraftData,
} from "@/lib/client-portal/poptavka-objednavka-types";
import { POPTAVKA_OBJEDNAVKA_DRAFT_DATA_VERSION } from "@/lib/client-portal/poptavka-objednavka-types";
import { parseDatetimeLocalToIso } from "@/lib/logistika-okna";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function nullableField(formData: FormData, name: string) {
  const value = field(formData, name);
  return value || null;
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  return trimmed;
}

function parseJsonArray<T>(raw: string): T[] | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

function parsePricingJson(raw: string): ObjednavkaPricingBlock | null {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as ObjednavkaPricingBlock;
  } catch {
    return null;
  }
}

export function mergeObjednavkaDraftFromFormData(
  base: PoptavkaObjednavkaDraftData,
  formData: FormData
): PoptavkaObjednavkaDraftData {
  const sestavaJson = field(formData, "sestava_konfigurator_json");
  const technikaJson = field(formData, "technika_json");
  const extraPolozkyJson = field(formData, "extra_polozky_json");
  const pricingJson = field(formData, "pricing_json");

  const extraPolozky =
    parseJsonArray<ObjednavkaExtraPolozka>(extraPolozkyJson) ?? base.technickePlneni.extraPolozky;
  const pricing = parsePricingJson(pricingJson) ?? base.pricing;

  return {
    draftVersion: POPTAVKA_OBJEDNAVKA_DRAFT_DATA_VERSION,
    upravenoOprotiPoptavce: formData.get("upraveno_oproti_poptavce") === "on",
    sestava: sestavaJson.trim()
      ? parseSestavaKonfiguratorJson(sestavaJson)
      : base.sestava,
    technika: technikaJson.trim() ? parseTechnikaJson(technikaJson) ?? base.technika : base.technika,
    klient: {
      nazev: nullableField(formData, "klient_nazev"),
      ico: nullableField(formData, "klient_ico"),
      dic: nullableField(formData, "klient_dic"),
      adresa: nullableField(formData, "klient_adresa"),
      kontaktJmeno: nullableField(formData, "klient_kontakt_jmeno"),
      telefon: nullableField(formData, "klient_telefon"),
      email: nullableField(formData, "klient_email"),
      bankovniSpojeni: nullableField(formData, "klient_bankovni_spojeni"),
    },
    dodavatel: {
      nazev: nullableField(formData, "dodavatel_nazev"),
      ico: nullableField(formData, "dodavatel_ico"),
      dic: nullableField(formData, "dodavatel_dic"),
      adresa: nullableField(formData, "dodavatel_adresa"),
      kontaktJmeno: nullableField(formData, "dodavatel_kontakt_jmeno"),
      telefon: nullableField(formData, "dodavatel_telefon"),
      email: nullableField(formData, "dodavatel_email"),
      bankovniSpojeni: nullableField(formData, "dodavatel_bankovni_spojeni"),
    },
    akce: {
      nazevAkce: nullableField(formData, "akce_nazev"),
      typAkceKod: nullableField(formData, "akce_typ_kod") ?? base.akce.typAkceKod,
      typAkce:
        TYP_AKCE_OPTIONS.find((opt) => opt.value === field(formData, "akce_typ_kod"))?.label ??
        base.akce.typAkce,
      typAkcePoznamka: nullableField(formData, "akce_typ_poznamka"),
      datumOd: nullableField(formData, "akce_datum_od"),
      datumDo: nullableField(formData, "akce_datum_do"),
      casProgramuOd: normalizeTime(field(formData, "akce_cas_od")),
      casProgramuDo: normalizeTime(field(formData, "akce_cas_do")),
      viceDenni: formData.get("akce_vice_denni") === "on",
      poznamka: nullableField(formData, "akce_poznamka"),
      presnyPopisMista: nullableField(formData, "presny_popis_mista"),
      logistikaPoznamkaKlienta: nullableField(formData, "logistika_poznamka_klienta"),
    },
    misto: {
      ...base.misto,
      nazev: nullableField(formData, "misto_nazev"),
      adresa: nullableField(formData, "misto_adresa"),
      gps: {
        lat: parseOptionalNumber(field(formData, "misto_gps_lat")),
        lng: parseOptionalNumber(field(formData, "misto_gps_lng")),
      },
    },
    organizace: {
      prijezdTechniky: nullableField(formData, "org_prijezd_techniky"),
      stavba: {
        oknoOd: nullableField(formData, "stavba_okno_od") ?? base.organizace.stavba.oknoOd,
        oknoDo: nullableField(formData, "stavba_okno_do") ?? base.organizace.stavba.oknoDo,
        realizaceOd: parseDatetimeLocalToIso(field(formData, "stavba_realizace_od")),
        realizaceDo: parseDatetimeLocalToIso(field(formData, "stavba_realizace_do")),
        datum: nullableField(formData, "stavba_datum"),
        casOd: normalizeTime(field(formData, "stavba_cas_od")),
        casDo: normalizeTime(field(formData, "stavba_cas_do")),
        pristupOd: nullableField(formData, "stavba_pristup_od"),
        omezeniVjezdu: nullableField(formData, "stavba_omezeni_vjezdu"),
        poznamka: nullableField(formData, "stavba_poznamka"),
      },
      bourani: {
        oknoOd: nullableField(formData, "bourani_okno_od") ?? base.organizace.bourani.oknoOd,
        oknoDo: nullableField(formData, "bourani_okno_do") ?? base.organizace.bourani.oknoDo,
        realizaceOd: parseDatetimeLocalToIso(field(formData, "bourani_realizace_od")),
        realizaceDo: parseDatetimeLocalToIso(field(formData, "bourani_realizace_do")),
        datum: nullableField(formData, "bourani_datum"),
        casOd: normalizeTime(field(formData, "bourani_cas_od")),
        casDo: normalizeTime(field(formData, "bourani_cas_do")),
        pristupOd: null,
        omezeniVjezdu: null,
        poznamka: nullableField(formData, "bourani_poznamka"),
        mistoUvolnenoDo: nullableField(formData, "bourani_misto_uvolneno_do"),
      },
      soucinnostKlienta: nullableField(formData, "org_soucinnost_klienta"),
    },
    technickePlneni: {
      setupy: base.technickePlneni.setupy,
      extraPolozky,
      oblasti: base.technickePlneni.oblasti,
      poznamkaKTechnice: base.technickePlneni.poznamkaKTechnice,
    },
    smluvniPodminky: {
      zavaznost: field(formData, "smluvni_zavaznost"),
      soucinnostKlienta: field(formData, "smluvni_soucinnost"),
      elektroTechnicke: field(formData, "smluvni_elektro"),
      pocasiVyssiMoc: field(formData, "smluvni_pocasi"),
      storno: field(formData, "smluvni_storno"),
      odpovednostZaMisto: field(formData, "smluvni_odpovednost"),
      bezpecnost: field(formData, "smluvni_bezpecnost"),
      platebni: nullableField(formData, "smluvni_platebni"),
    },
    textProKlienta: {
      uvod: nullableField(formData, "text_uvod"),
      zaver: nullableField(formData, "text_zaver"),
      poznamkaSefa: nullableField(formData, "text_poznamka_sefa"),
    },
    fotky: base.fotky,
    pricing,
    validationWarnings: [],
  };
}

export const OBJEDNAVKA_DRAFT_STAV_LABELS: Record<string, string> = {
  rozpracovano: "Rozpracováno",
  pripraveno_k_odeslani: "Připraveno k odeslání",
  odeslano: "Odesláno",
  archivovano: "Archivováno",
};
