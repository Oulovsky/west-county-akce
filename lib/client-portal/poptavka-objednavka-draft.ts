import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTypAkce } from "@/lib/client-portal/poptavka-form";
import type { InternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import { DEFAULT_PORTAL_SESTAVA_KATALOG } from "@/lib/client-portal/sestava-konfigurator-katalog";
import {
  EMPTY_SESTAVA_KONFIGURATOR,
  formatSestavaSummaryText,
  migrateLegacySestavaState,
  sestavaFromOdpovediExtra,
} from "@/lib/client-portal/sestava-konfigurator-form";
import { syncPoptavkaObjednavkaDraftDerived } from "@/lib/client-portal/poptavka-objednavka-draft-sync";
import {
  EMPTY_POPTAVKA_TECHNIKA,
  technikaFromRecord,
} from "@/lib/client-portal/poptavka-technika-form";
import { loadInternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import { cloneVychoziSmluvniPodminky } from "@/lib/client-portal/poptavka-objednavka-sablony";
import {
  POPTAVKA_OBJEDNAVKA_DRAFT_DATA_VERSION,
  POPTAVKA_OBJEDNAVKA_DRAFT_SCHEMA_VERSION,
  POPTAVKA_OBJEDNAVKA_SNAPSHOT_SCHEMA_VERSION,
  POPTAVKA_OBJEDNAVKA_SNAPSHOT_VERSION,
  type AkceBlock,
  type BouraniBlock,
  type DraftToSnapshotParams,
  type FotkaDraft,
  type FotkaSnapshot,
  type MistoElektroBlock,
  type MistoTechnickeBlock,
  type OblastPlneniBlock,
  type OrganizaceBlock,
  type PartyBlock,
  type PoptavkaObjednavkaDraftData,
  type PoptavkaObjednavkaSnapshot,
  type PoptavkaObjednavkaTriVolba,
  type SmluvniPodminkyBlock,
  type TechnickePlneniBlock,
  type TerminBlock,
  type TextProKlientaBlock,
} from "@/lib/client-portal/poptavka-objednavka-types";
import type { PoptavkaTechnickeUdaje, SetupOblast } from "@/lib/client-portal/types";
import { SETUP_OBLASTI } from "@/lib/client-portal/types";
import {
  formatFakturacniFirmaAddress,
  getEffectiveFakturacniFirma,
  type FakturacniFirma,
} from "@/lib/fakturacni-firmy";

export type {
  AkceBlock,
  BouraniBlock,
  DraftToSnapshotParams,
  FotkaDraft,
  FotkaSnapshot,
  MistoElektroBlock,
  MistoTechnickeBlock,
  ObjednavkaSetupPolozka,
  OrganizaceBlock,
  PartyBlock,
  PoptavkaObjednavkaDraftData,
  PoptavkaObjednavkaSnapshot,
  PoptavkaObjednavkaSnapshotMeta,
  PoptavkaObjednavkaSnapshotSources,
  PoptavkaObjednavkaTriVolba,
  SmluvniPodminkyBlock,
  TechnickePlneniBlock,
  TerminBlock,
  TextProKlientaBlock,
} from "@/lib/client-portal/poptavka-objednavka-types";

export {
  POPTAVKA_OBJEDNAVKA_DRAFT_DATA_VERSION,
  POPTAVKA_OBJEDNAVKA_DRAFT_SCHEMA_VERSION,
  POPTAVKA_OBJEDNAVKA_SNAPSHOT_SCHEMA_VERSION,
  POPTAVKA_OBJEDNAVKA_SNAPSHOT_VERSION,
} from "@/lib/client-portal/poptavka-objednavka-types";

export { cloneVychoziSmluvniPodminky, VYCHOZI_SMLOUVNI_PODMINKY } from "@/lib/client-portal/poptavka-objednavka-sablony";

export type BuildPoptavkaObjednavkaDraftOptions = {
  fakturacniFirmaId?: string | null;
  fakturacniFirma?: FakturacniFirma | null;
};

type MistoKonaniRow = {
  nazev: string;
  adresa_text: string | null;
  lat: number | null;
  lng: number | null;
  poznamka: string | null;
};

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeTime(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  return trimmed;
}

function toOptionalNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseTriVolba(value: unknown): PoptavkaObjednavkaTriVolba | null {
  if (value === "ano" || value === "ne" || value === "nevim") return value;
  return null;
}

function joinNonEmpty(parts: Array<string | null | undefined>, separator = "\n"): string | null {
  const lines = parts.map((part) => part?.trim()).filter(Boolean) as string[];
  return lines.length > 0 ? lines.join(separator) : null;
}

function formatKlientAddress(klient: InternalPoptavkaDetail["klient"]): string | null {
  if (!klient) return null;
  return joinNonEmpty(
    [klient.ulice, [klient.psc, klient.mesto].filter(Boolean).join(" ")].filter(Boolean),
    ", "
  );
}

function emptyTerminBlock(): TerminBlock {
  return {
    oknoOd: null,
    oknoDo: null,
    realizaceOd: null,
    realizaceDo: null,
    datum: null,
    casOd: null,
    casDo: null,
    pristupOd: null,
    omezeniVjezdu: null,
    poznamka: null,
  };
}

function emptyBouraniBlock(): BouraniBlock {
  return {
    ...emptyTerminBlock(),
    mistoUvolnenoDo: null,
  };
}

function emptyElektroBlock(): MistoElektroBlock {
  return {
    pripojka: null,
    jisteni: null,
    zasuvka: null,
    vzdalenostM: null,
    rozvadecePoznamka: null,
    kabeloveTrasy: null,
    kabelPresSilnici: null,
    potrebaElektrocentraly: null,
    vzdalenostRozvadece: null,
  };
}

function emptyMistoBlock(): MistoTechnickeBlock {
  return {
    nazev: null,
    adresa: null,
    gps: { lat: null, lng: null },
    prijezdPopis: null,
    pristupovaCesta: null,
    povrchTeren: null,
    vjezdTechnikou: null,
    mistoStage: null,
    mistoFoh: null,
    mistoLedRezie: null,
    elektro: emptyElektroBlock(),
    omezeniHluku: null,
    casovaOmezeni: null,
    nocniPraceOmezeni: null,
    kotveniZaveseni: null,
    pozadavkyPoradatele: null,
    dalsiTechnickePoznamky: null,
    pozadovanVyjezdTechnika: false,
  };
}

function emptyOblastiPlneni(): Record<SetupOblast, OblastPlneniBlock> {
  return Object.fromEntries(
    SETUP_OBLASTI.map((oblast) => [oblast, { popis: null, poznamka: null }])
  ) as Record<SetupOblast, OblastPlneniBlock>;
}

function emptyTechnickePlneni(): TechnickePlneniBlock {
  return {
    setupy: [],
    oblasti: emptyOblastiPlneni(),
    poznamkaKTechnice: null,
  };
}

function emptyTextProKlienta(): TextProKlientaBlock {
  return {
    uvod: null,
    zaver: null,
    poznamkaSefa: null,
  };
}

function emptyPartyBlock(): PartyBlock {
  return {
    nazev: null,
    ico: null,
    dic: null,
    adresa: null,
    kontaktJmeno: null,
    telefon: null,
    email: null,
    bankovniSpojeni: null,
  };
}

export function createEmptyPoptavkaObjednavkaDraftData(): PoptavkaObjednavkaDraftData {
  return {
    draftVersion: POPTAVKA_OBJEDNAVKA_DRAFT_DATA_VERSION,
    upravenoOprotiPoptavce: false,
    klient: emptyPartyBlock(),
    dodavatel: emptyPartyBlock(),
    akce: {
      nazevAkce: null,
      typAkce: null,
      typAkceKod: null,
      typAkcePoznamka: null,
      datumOd: null,
      datumDo: null,
      casProgramuOd: null,
      casProgramuDo: null,
      viceDenni: false,
      poznamka: null,
      presnyPopisMista: null,
      logistikaPoznamkaKlienta: null,
    },
    misto: emptyMistoBlock(),
    organizace: {
      prijezdTechniky: null,
      stavba: emptyTerminBlock(),
      bourani: emptyBouraniBlock(),
      soucinnostKlienta: null,
    },
    technickePlneni: emptyTechnickePlneni(),
    smluvniPodminky: cloneVychoziSmluvniPodminky(),
    textProKlienta: emptyTextProKlienta(),
    fotky: [],
    sestava: { ...EMPTY_SESTAVA_KONFIGURATOR },
    technika: { ...EMPTY_POPTAVKA_TECHNIKA },
    pricing: null,
    validationWarnings: [],
  };
}

function buildKlientParty(detail: InternalPoptavkaDetail): PartyBlock {
  const klient = detail.klient;
  return {
    nazev: nullableText(klient?.nazev ?? null),
    ico: nullableText(klient?.ico ?? null),
    dic: nullableText(klient?.dic ?? null),
    adresa: formatKlientAddress(klient),
    kontaktJmeno: nullableText(detail.kontakt_jmeno),
    telefon: nullableText(detail.kontakt_telefon ?? klient?.telefon ?? null),
    email: nullableText(detail.kontakt_email ?? klient?.email ?? null),
    bankovniSpojeni: null,
  };
}

function buildDodavatelParty(firma: FakturacniFirma | null | undefined): PartyBlock {
  if (!firma) return emptyPartyBlock();

  return {
    nazev: nullableText(firma.nazev),
    ico: nullableText(firma.ico),
    dic: nullableText(firma.dic),
    adresa: nullableText(formatFakturacniFirmaAddress(firma)),
    kontaktJmeno: null,
    telefon: nullableText(firma.telefon),
    email: nullableText(firma.email),
    bankovniSpojeni: nullableText(firma.bankovni_ucet ?? firma.iban ?? null),
  };
}

function buildAkceBlock(detail: InternalPoptavkaDetail): AkceBlock {
  return {
    nazevAkce: nullableText(detail.misto_nazev),
    typAkce: nullableText(formatTypAkce(detail.typ_akce)),
    typAkceKod: nullableText(detail.typ_akce),
    typAkcePoznamka: nullableText(detail.typ_akce_poznamka),
    datumOd: nullableText(detail.datum_od),
    datumDo: nullableText(detail.datum_do),
    casProgramuOd: normalizeTime(detail.cas_programu_od),
    casProgramuDo: normalizeTime(detail.cas_programu_do),
    viceDenni: detail.vice_denni,
    poznamka: nullableText(detail.misto_poznamka),
    presnyPopisMista: nullableText(detail.presny_popis_mista),
    logistikaPoznamkaKlienta: nullableText(detail.logistika_poznamka_klienta),
  };
}

function buildMistoBlock(
  detail: InternalPoptavkaDetail,
  technika: PoptavkaTechnickeUdaje | null,
  mistoKonani: MistoKonaniRow | null
): MistoTechnickeBlock {
  const extra = technika?.odpovedi_extra ?? {};
  const sestava = sestavaFromOdpovediExtra(extra);
  const sestavaSummary = formatSestavaSummaryText(sestava, DEFAULT_PORTAL_SESTAVA_KATALOG);
  const kotveniText =
    sestava.kotveni_typ === "ibc_boxy"
      ? "Zátěž IBC boxy (pořadatel zajistí vodu)"
      : sestava.kotveni_typ === "zatloukane"
        ? "Zatloukané kotvení"
        : null;
  const lat =
    toOptionalNumber(detail.misto_lat) ?? toOptionalNumber(mistoKonani?.lat ?? null);
  const lng =
    toOptionalNumber(detail.misto_lng) ?? toOptionalNumber(mistoKonani?.lng ?? null);

  const prijezd = nullableText(technika?.prijezd_poznamka);
  const parkovani = nullableText(technika?.parkovani_poznamka);

  return {
    nazev: nullableText(detail.misto_nazev ?? mistoKonani?.nazev ?? null),
    adresa: nullableText(detail.misto_adresa ?? mistoKonani?.adresa_text ?? null),
    gps: { lat, lng },
    prijezdPopis: prijezd,
    pristupovaCesta: joinNonEmpty([prijezd, parkovani]),
    povrchTeren: parseTriVolba(extra.misto_zpevnene),
    vjezdTechnikou: parseTriVolba(extra.lze_zajet_autem),
    mistoStage: nullableText(technika?.misto_stage),
    mistoFoh: nullableText(technika?.misto_foh),
    mistoLedRezie: null,
    elektro: {
      pripojka: nullableText(technika?.elektro_pripojka),
      jisteni: nullableText(technika?.elektro_jisteni),
      zasuvka: nullableText(technika?.elektro_zasuvka),
      vzdalenostM: toOptionalNumber(technika?.elektro_vzdalenost_m),
      rozvadecePoznamka: nullableText(technika?.rozvadece_poznamka),
      kabeloveTrasy: nullableText(technika?.kabelove_trasy),
      kabelPresSilnici: parseTriVolba(extra.kabel_pres_silnici),
      potrebaElektrocentraly: null,
      vzdalenostRozvadece: nullableText(technika?.rozvadece_poznamka),
    },
    omezeniHluku: nullableText(technika?.omezeni_hluku),
    casovaOmezeni: nullableText(technika?.casova_omezeni),
    nocniPraceOmezeni: null,
    kotveniZaveseni: joinNonEmpty([kotveniText, sestava.kotveni_povrch || null]),
    pozadavkyPoradatele: nullableText(technika?.dalsi_poznamky),
    dalsiTechnickePoznamky: joinNonEmpty([
      technika?.dalsi_poznamky,
      sestavaSummary || null,
      mistoKonani?.poznamka ? `Poznámka k místu konání: ${mistoKonani.poznamka}` : null,
    ]),
    pozadovanVyjezdTechnika: technika?.pozadovan_vyjezd_technika ?? false,
  };
}

function buildOrganizaceBlock(detail: InternalPoptavkaDetail): OrganizaceBlock {
  const logistikaNote = joinNonEmpty([
    detail.logistika_poznamka_klienta,
    detail.stavba_pristup_od ? `Přístup od: ${detail.stavba_pristup_od}` : null,
    detail.stavba_omezeni_vjezdu ? `Omezení vjezdu: ${detail.stavba_omezeni_vjezdu}` : null,
  ]);

  return {
    prijezdTechniky: nullableText(detail.cas_prijezd_orientacni),
    stavba: {
      oknoOd: nullableText(detail.stavba_okno_od),
      oknoDo: nullableText(detail.stavba_okno_do),
      realizaceOd: null,
      realizaceDo: null,
      datum: null,
      casOd: null,
      casDo: null,
      pristupOd: nullableText(detail.stavba_pristup_od),
      omezeniVjezdu: nullableText(detail.stavba_omezeni_vjezdu),
      poznamka: joinNonEmpty([detail.stavba_poznamka, logistikaNote || null]),
    },
    bourani: {
      oknoOd: nullableText(detail.bourani_okno_od),
      oknoDo: nullableText(detail.bourani_okno_do),
      realizaceOd: null,
      realizaceDo: null,
      datum: null,
      casOd: null,
      casDo: null,
      pristupOd: null,
      omezeniVjezdu: null,
      poznamka: nullableText(detail.bourani_poznamka),
      mistoUvolnenoDo: nullableText(detail.bourani_misto_uvolneno_do),
    },
    soucinnostKlienta: null,
  };
}

function buildTechnickePlneniBlock(detail: InternalPoptavkaDetail): TechnickePlneniBlock {
  const setupy = detail.setupy.map((row) => ({
    setupId: row.setup_id,
    nazev: row.setup.nazev,
    oblast: row.setup.oblast,
    mnozstvi: Math.max(1, Math.floor(Number(row.mnozstvi) || 1)),
    poznamkaKlienta: nullableText(row.poznamka_klienta),
    poznamkaInterni: null,
  }));

  const setupNotes = setupy
    .map((row) =>
      row.poznamkaKlienta ? `${row.nazev}: ${row.poznamkaKlienta}` : null
    )
    .filter(Boolean) as string[];

  const sestavaSummary = formatSestavaSummaryText(
    sestavaFromOdpovediExtra(detail.technicke_udaje?.odpovedi_extra ?? {}),
    DEFAULT_PORTAL_SESTAVA_KATALOG
  );

  return {
    setupy,
    oblasti: emptyOblastiPlneni(),
    poznamkaKTechnice:
      joinNonEmpty([setupNotes.length > 0 ? setupNotes.join("\n") : null, sestavaSummary || null]) ??
      null,
  };
}

function buildFotkyDraft(detail: InternalPoptavkaDetail): FotkaDraft[] {
  return detail.fotky.map((row) => ({
    fotkaId: row.id,
    typ: row.typ,
    popis: nullableText(row.popis),
    storagePath: row.storage_path,
    storageBucket: row.storage_bucket,
    poradi: row.poradi,
    zahrnoutDoObjednavky: true,
  }));
}

function hasElektroUdaje(misto: MistoTechnickeBlock): boolean {
  const e = misto.elektro;
  return Boolean(
    e.pripojka ||
      e.jisteni ||
      e.zasuvka ||
      e.vzdalenostM != null ||
      e.rozvadecePoznamka ||
      e.kabeloveTrasy ||
      e.kabelPresSilnici ||
      e.potrebaElektrocentraly ||
      e.vzdalenostRozvadece
  );
}

function hasTermin(termin: TerminBlock): boolean {
  return Boolean(
    termin.oknoOd ||
      termin.oknoDo ||
      termin.realizaceOd ||
      termin.realizaceDo ||
      termin.datum ||
      termin.casOd ||
      termin.casDo ||
      termin.poznamka
  );
}

export function getPoptavkaObjednavkaDraftWarnings(
  draft: PoptavkaObjednavkaDraftData
): string[] {
  const warnings: string[] = [];

  if (!draft.dodavatel.nazev) {
    warnings.push("Chybí fakturační firma (dodavatel).");
  }
  if (!draft.klient.email) {
    warnings.push("Chybí e-mail kontaktní osoby klienta.");
  }
  if (!draft.misto.nazev && !draft.misto.adresa) {
    warnings.push("Chybí název nebo adresa místa akce.");
  }
  if (!hasElektroUdaje(draft.misto)) {
    warnings.push("Chybí údaje o elektro přípojce nebo rozváděčích.");
  }
  if (!hasTermin(draft.organizace.stavba)) {
    warnings.push("Chybí klientské okno nebo interní termín stavby.");
  }
  if (!hasTermin(draft.organizace.bourani)) {
    warnings.push("Chybí klientské okno nebo interní termín bourání.");
  }
  if (
    !draft.misto.prijezdPopis &&
    !draft.misto.pristupovaCesta &&
    !draft.misto.mistoStage &&
    !draft.misto.mistoFoh &&
    !draft.misto.dalsiTechnickePoznamky
  ) {
    warnings.push("Chybí technické údaje o místě akce.");
  }
  return warnings;
}

function normalizePartyBlock(party: PartyBlock): PartyBlock {
  return {
    nazev: nullableText(party.nazev),
    ico: nullableText(party.ico),
    dic: nullableText(party.dic),
    adresa: nullableText(party.adresa),
    kontaktJmeno: nullableText(party.kontaktJmeno),
    telefon: nullableText(party.telefon),
    email: nullableText(party.email),
    bankovniSpojeni: nullableText(party.bankovniSpojeni),
  };
}

function normalizeTerminBlock(termin: TerminBlock): TerminBlock {
  return {
    oknoOd: nullableText(termin.oknoOd),
    oknoDo: nullableText(termin.oknoDo),
    realizaceOd: nullableText(termin.realizaceOd),
    realizaceDo: nullableText(termin.realizaceDo),
    datum: nullableText(termin.datum),
    casOd: normalizeTime(termin.casOd),
    casDo: normalizeTime(termin.casDo),
    pristupOd: nullableText(termin.pristupOd),
    omezeniVjezdu: nullableText(termin.omezeniVjezdu),
    poznamka: nullableText(termin.poznamka),
  };
}

function normalizeSmluvniPodminky(block: SmluvniPodminkyBlock): SmluvniPodminkyBlock {
  return {
    zavaznost: block.zavaznost.trim(),
    soucinnostKlienta: block.soucinnostKlienta.trim(),
    elektroTechnicke: block.elektroTechnicke.trim(),
    pocasiVyssiMoc: block.pocasiVyssiMoc.trim(),
    storno: block.storno.trim(),
    odpovednostZaMisto: block.odpovednostZaMisto.trim(),
    bezpecnost: block.bezpecnost.trim(),
    platebni: nullableText(block.platebni),
  };
}

export function normalizePoptavkaObjednavkaDraftData(
  input: PoptavkaObjednavkaDraftData
): PoptavkaObjednavkaDraftData {
  const draft: PoptavkaObjednavkaDraftData = {
    draftVersion: POPTAVKA_OBJEDNAVKA_DRAFT_DATA_VERSION,
    upravenoOprotiPoptavce: Boolean(input.upravenoOprotiPoptavce),
    klient: normalizePartyBlock(input.klient),
    dodavatel: normalizePartyBlock(input.dodavatel),
    akce: {
      nazevAkce: nullableText(input.akce.nazevAkce),
      typAkce: nullableText(input.akce.typAkce),
      typAkceKod: nullableText(input.akce.typAkceKod),
      typAkcePoznamka: nullableText(input.akce.typAkcePoznamka),
      datumOd: nullableText(input.akce.datumOd),
      datumDo: nullableText(input.akce.datumDo),
      casProgramuOd: normalizeTime(input.akce.casProgramuOd),
      casProgramuDo: normalizeTime(input.akce.casProgramuDo),
      viceDenni: input.akce.viceDenni,
      poznamka: nullableText(input.akce.poznamka),
      presnyPopisMista: nullableText(input.akce.presnyPopisMista),
      logistikaPoznamkaKlienta: nullableText(input.akce.logistikaPoznamkaKlienta),
    },
    misto: {
      nazev: nullableText(input.misto.nazev),
      adresa: nullableText(input.misto.adresa),
      gps: {
        lat: toOptionalNumber(input.misto.gps.lat),
        lng: toOptionalNumber(input.misto.gps.lng),
      },
      prijezdPopis: nullableText(input.misto.prijezdPopis),
      pristupovaCesta: nullableText(input.misto.pristupovaCesta),
      povrchTeren: parseTriVolba(input.misto.povrchTeren),
      vjezdTechnikou: parseTriVolba(input.misto.vjezdTechnikou),
      mistoStage: nullableText(input.misto.mistoStage),
      mistoFoh: nullableText(input.misto.mistoFoh),
      mistoLedRezie: nullableText(input.misto.mistoLedRezie),
      elektro: {
        pripojka: nullableText(input.misto.elektro.pripojka),
        jisteni: nullableText(input.misto.elektro.jisteni),
        zasuvka: nullableText(input.misto.elektro.zasuvka),
        vzdalenostM: toOptionalNumber(input.misto.elektro.vzdalenostM),
        rozvadecePoznamka: nullableText(input.misto.elektro.rozvadecePoznamka),
        kabeloveTrasy: nullableText(input.misto.elektro.kabeloveTrasy),
        kabelPresSilnici: parseTriVolba(input.misto.elektro.kabelPresSilnici),
        potrebaElektrocentraly: parseTriVolba(input.misto.elektro.potrebaElektrocentraly),
        vzdalenostRozvadece: nullableText(input.misto.elektro.vzdalenostRozvadece),
      },
      omezeniHluku: nullableText(input.misto.omezeniHluku),
      casovaOmezeni: nullableText(input.misto.casovaOmezeni),
      nocniPraceOmezeni: nullableText(input.misto.nocniPraceOmezeni),
      kotveniZaveseni: nullableText(input.misto.kotveniZaveseni),
      pozadavkyPoradatele: nullableText(input.misto.pozadavkyPoradatele),
      dalsiTechnickePoznamky: nullableText(input.misto.dalsiTechnickePoznamky),
      pozadovanVyjezdTechnika: Boolean(input.misto.pozadovanVyjezdTechnika),
    },
    organizace: {
      prijezdTechniky: nullableText(input.organizace.prijezdTechniky),
      stavba: normalizeTerminBlock(input.organizace.stavba),
      bourani: {
        ...normalizeTerminBlock(input.organizace.bourani),
        mistoUvolnenoDo: nullableText(input.organizace.bourani.mistoUvolnenoDo),
      },
      soucinnostKlienta: nullableText(input.organizace.soucinnostKlienta),
    },
    technickePlneni: {
      setupy: (input.technickePlneni.setupy ?? []).map((row) => ({
        setupId: row.setupId,
        nazev: row.nazev.trim(),
        oblast: row.oblast,
        mnozstvi: Math.max(1, Math.floor(Number(row.mnozstvi) || 1)),
        poznamkaKlienta: nullableText(row.poznamkaKlienta),
        poznamkaInterni: nullableText(row.poznamkaInterni),
      })),
      oblasti: Object.fromEntries(
        SETUP_OBLASTI.map((oblast) => [
          oblast,
          {
            popis: nullableText(input.technickePlneni.oblasti?.[oblast]?.popis),
            poznamka: nullableText(input.technickePlneni.oblasti?.[oblast]?.poznamka),
          },
        ])
      ) as Record<SetupOblast, OblastPlneniBlock>,
      poznamkaKTechnice: nullableText(input.technickePlneni.poznamkaKTechnice),
    },
    smluvniPodminky: normalizeSmluvniPodminky(input.smluvniPodminky),
    textProKlienta: {
      uvod: nullableText(input.textProKlienta.uvod),
      zaver: nullableText(input.textProKlienta.zaver),
      poznamkaSefa: nullableText(input.textProKlienta.poznamkaSefa),
    },
    fotky: (input.fotky ?? []).map((row) => ({
      fotkaId: row.fotkaId,
      typ: row.typ,
      popis: nullableText(row.popis),
      storagePath: row.storagePath,
      storageBucket: row.storageBucket,
      poradi: Number.isFinite(row.poradi) ? row.poradi : 0,
      zahrnoutDoObjednavky: row.zahrnoutDoObjednavky !== false,
    })),
    sestava: migrateLegacySestavaState(
      (input.sestava as Partial<typeof EMPTY_SESTAVA_KONFIGURATOR> | undefined) ??
        EMPTY_SESTAVA_KONFIGURATOR
    ),
    technika: {
      ...EMPTY_POPTAVKA_TECHNIKA,
      ...(input.technika ?? {}),
    },
    pricing: null,
    validationWarnings: [],
  };

  draft.validationWarnings = getPoptavkaObjednavkaDraftWarnings(draft);
  return syncPoptavkaObjednavkaDraftDerived(draft);
}

export function buildPoptavkaObjednavkaDraftFromDetail(
  detail: InternalPoptavkaDetail,
  options: BuildPoptavkaObjednavkaDraftOptions & {
    mistoKonani?: MistoKonaniRow | null;
  } = {}
): PoptavkaObjednavkaDraftData {
  const technika = detail.technicke_udaje;
  const mistoKonani = options.mistoKonani ?? null;
  const firma = options.fakturacniFirma ?? null;

  const draft = createEmptyPoptavkaObjednavkaDraftData();
  draft.klient = buildKlientParty(detail);
  draft.dodavatel = buildDodavatelParty(firma);
  draft.akce = buildAkceBlock(detail);
  draft.misto = buildMistoBlock(detail, technika, mistoKonani);
  draft.organizace = buildOrganizaceBlock(detail);
  draft.technickePlneni = buildTechnickePlneniBlock(detail);
  draft.smluvniPodminky = cloneVychoziSmluvniPodminky();
  draft.textProKlienta = emptyTextProKlienta();
  draft.fotky = buildFotkyDraft(detail);
  draft.sestava = sestavaFromOdpovediExtra(technika?.odpovedi_extra ?? {});
  draft.technika = technikaFromRecord(technika);

  return syncPoptavkaObjednavkaDraftDerived(normalizePoptavkaObjednavkaDraftData(draft));
}

async function loadMistoKonani(
  supabase: SupabaseClient,
  mistoId: string | null
): Promise<MistoKonaniRow | null> {
  if (!mistoId) return null;

  const { data, error } = await supabase
    .from("mista_konani")
    .select("nazev, adresa_text, lat, lng, poznamka")
    .eq("misto_id", mistoId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as MistoKonaniRow | null) ?? null;
}

async function loadFakturacniFirmaForDraft(
  supabase: SupabaseClient,
  options: BuildPoptavkaObjednavkaDraftOptions
): Promise<FakturacniFirma | null> {
  if (options.fakturacniFirma) {
    return options.fakturacniFirma;
  }

  const { data, error } = await supabase
    .from("fakturacni_firmy")
    .select("*")
    .eq("aktivni", true)
    .order("vychozi", { ascending: false })
    .order("nazev", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return getEffectiveFakturacniFirma(
    (data ?? []) as FakturacniFirma[],
    options.fakturacniFirmaId
  );
}

export async function buildPoptavkaObjednavkaDraftFromPoptavka(
  supabase: SupabaseClient,
  poptavkaId: string,
  options: BuildPoptavkaObjednavkaDraftOptions = {}
): Promise<PoptavkaObjednavkaDraftData | null> {
  const detail = await loadInternalPoptavkaDetail(supabase, poptavkaId);
  if (!detail) {
    return null;
  }

  const [firma, mistoKonani] = await Promise.all([
    loadFakturacniFirmaForDraft(supabase, options),
    loadMistoKonani(supabase, detail.misto_id),
  ]);

  return buildPoptavkaObjednavkaDraftFromDetail(detail, {
    ...options,
    fakturacniFirma: firma,
    mistoKonani,
  });
}

function snapshotBlocksFromDraft(draft: PoptavkaObjednavkaDraftData): Pick<
  PoptavkaObjednavkaSnapshot,
  | "klient"
  | "dodavatel"
  | "akce"
  | "misto"
  | "organizace"
  | "technickePlneni"
  | "smluvniPodminky"
  | "textProKlienta"
  | "pricing"
  | "sestava"
  | "technika"
> {
  return {
    klient: draft.klient,
    dodavatel: draft.dodavatel,
    akce: draft.akce,
    misto: draft.misto,
    organizace: draft.organizace,
    technickePlneni: draft.technickePlneni,
    smluvniPodminky: draft.smluvniPodminky,
    textProKlienta: draft.textProKlienta,
    sestava: draft.sestava,
    technika: draft.technika,
    pricing: null,
  };
}

function draftFotkyToSnapshot(
  draft: PoptavkaObjednavkaDraftData,
  fotkaPublicUrls?: Record<string, string | null | undefined>
): FotkaSnapshot[] {
  return draft.fotky
    .filter((row) => row.zahrnoutDoObjednavky)
    .map((row) => ({
      fotkaId: row.fotkaId,
      typ: row.typ,
      popis: row.popis,
      storagePath: row.storagePath,
      storageBucket: row.storageBucket,
      poradi: row.poradi,
      publicUrl: fotkaPublicUrls?.[row.fotkaId] ?? null,
    }));
}

export function draftToPoptavkaObjednavkaSnapshot(
  params: DraftToSnapshotParams
): PoptavkaObjednavkaSnapshot {
  const normalizedDraft = normalizePoptavkaObjednavkaDraftData(params.draft);
  const blocks = snapshotBlocksFromDraft(normalizedDraft);

  return {
    version: POPTAVKA_OBJEDNAVKA_SNAPSHOT_VERSION,
    frozenAt: params.frozenAt ?? new Date().toISOString(),
    draftId: params.draftId,
    draftSchemaVersion: params.draftSchemaVersion ?? POPTAVKA_OBJEDNAVKA_DRAFT_SCHEMA_VERSION,
    snapshotSchemaVersion:
      params.snapshotSchemaVersion ?? POPTAVKA_OBJEDNAVKA_SNAPSHOT_SCHEMA_VERSION,
    meta: {
      poptavkaId: params.meta.poptavkaId,
      cisloPoptavky: params.meta.cisloPoptavky,
      linkId: params.linkId,
      navrhVerze: params.meta.navrhVerze,
      upravenoOprotiPoptavce: normalizedDraft.upravenoOprotiPoptavce,
    },
    ...blocks,
    fotky: draftFotkyToSnapshot(normalizedDraft, params.fotkaPublicUrls),
    sources: {
      poptavkaUpdatedAt: params.sources.poptavkaUpdatedAt,
      draftUpdatedAt: params.sources.draftUpdatedAt,
      preparedByUserId: params.sources.preparedByUserId,
    },
  };
}
