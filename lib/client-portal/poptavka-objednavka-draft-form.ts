import type {
  PoptavkaObjednavkaDraftData,
  PoptavkaObjednavkaTriVolba,
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

function parseTriVolba(value: string): PoptavkaObjednavkaTriVolba | null {
  if (value === "ano" || value === "ne" || value === "nevim") return value;
  return null;
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

export function mergeObjednavkaDraftFromFormData(
  base: PoptavkaObjednavkaDraftData,
  formData: FormData
): PoptavkaObjednavkaDraftData {
  return {
    draftVersion: POPTAVKA_OBJEDNAVKA_DRAFT_DATA_VERSION,
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
      typAkce: nullableField(formData, "akce_typ"),
      typAkceKod: base.akce.typAkceKod,
      typAkcePoznamka: nullableField(formData, "akce_typ_poznamka"),
      datumOd: nullableField(formData, "akce_datum_od"),
      datumDo: nullableField(formData, "akce_datum_do"),
      casProgramuOd: normalizeTime(field(formData, "akce_cas_od")),
      casProgramuDo: normalizeTime(field(formData, "akce_cas_do")),
      viceDenni: formData.get("akce_vice_denni") === "on",
      poznamka: nullableField(formData, "akce_poznamka"),
    },
    misto: {
      nazev: nullableField(formData, "misto_nazev"),
      adresa: nullableField(formData, "misto_adresa"),
      gps: {
        lat: parseOptionalNumber(field(formData, "misto_gps_lat")),
        lng: parseOptionalNumber(field(formData, "misto_gps_lng")),
      },
      prijezdPopis: nullableField(formData, "misto_prijezd"),
      pristupovaCesta: nullableField(formData, "misto_pristup"),
      povrchTeren: parseTriVolba(field(formData, "misto_povrch")),
      vjezdTechnikou: parseTriVolba(field(formData, "misto_vjezd")),
      mistoStage: nullableField(formData, "misto_stage"),
      mistoFoh: nullableField(formData, "misto_foh"),
      mistoLedRezie: nullableField(formData, "misto_led_rezie"),
      elektro: {
        pripojka: nullableField(formData, "elektro_pripojka"),
        jisteni: nullableField(formData, "elektro_jisteni"),
        zasuvka: nullableField(formData, "elektro_zasuvka"),
        vzdalenostM: parseOptionalNumber(field(formData, "elektro_vzdalenost_m")),
        rozvadecePoznamka: nullableField(formData, "elektro_rozvadece"),
        kabeloveTrasy: nullableField(formData, "elektro_kabelove_trasy"),
        kabelPresSilnici: parseTriVolba(field(formData, "elektro_kabel_pres_silnici")),
        potrebaElektrocentraly: parseTriVolba(field(formData, "elektro_centrala")),
        vzdalenostRozvadece: nullableField(formData, "elektro_vzdalenost_rozvadece"),
      },
      omezeniHluku: nullableField(formData, "misto_omezeni_hluku"),
      casovaOmezeni: nullableField(formData, "misto_casova_omezeni"),
      nocniPraceOmezeni: nullableField(formData, "misto_nocni_prace"),
      kotveniZaveseni: nullableField(formData, "misto_kotveni"),
      pozadavkyPoradatele: nullableField(formData, "misto_pozadavky_poradatele"),
      dalsiTechnickePoznamky: nullableField(formData, "misto_dalsi_poznamky"),
      pozadovanVyjezdTechnika: formData.get("misto_vyjezd_technika") === "on",
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
      oblasti: base.technickePlneni.oblasti,
      poznamkaKTechnice: nullableField(formData, "technika_poznamka"),
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
    pricing: null,
    validationWarnings: [],
  };
}

export const OBJEDNAVKA_DRAFT_STAV_LABELS: Record<string, string> = {
  rozpracovano: "Rozpracováno",
  pripraveno_k_odeslani: "Připraveno k odeslání",
  odeslano: "Odesláno",
  archivovano: "Archivováno",
};
