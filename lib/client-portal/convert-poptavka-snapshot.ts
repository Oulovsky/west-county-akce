import "server-only";

import { combineDateAndTime } from "@/app/zakazky/[id]/helpers";
import {
  formatLogistikaOknoLabel,
  getTerminOknoRange,
  getTerminRealizaceRange,
} from "@/lib/logistika-okna";
import { SETUP_OBLAST_LABELS } from "@/lib/client-portal/labels";
import type { InternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import type {
  BouraniBlock,
  PoptavkaObjednavkaSnapshot,
  TerminBlock,
} from "@/lib/client-portal/poptavka-objednavka-types";
import { SETUP_OBLASTI } from "@/lib/client-portal/types";

function normalizeTime(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  return trimmed;
}

function combineAkceRangeFromSnapshot(snapshot: PoptavkaObjednavkaSnapshot) {
  const { akce } = snapshot;
  const dateFrom = akce.datumOd;
  const dateTo = akce.datumDo ?? akce.datumOd;
  const timeFrom = normalizeTime(akce.casProgramuOd) ?? "08:00";
  const timeTo = normalizeTime(akce.casProgramuDo) ?? timeFrom;

  const akceOd = dateFrom ? combineDateAndTime(dateFrom, timeFrom) : null;
  const akceDo = dateTo ? combineDateAndTime(dateTo, timeTo) : null;

  return { akceOd, akceDo };
}

function combineTerminRange(termin: TerminBlock | BouraniBlock) {
  return getTerminRealizaceRange(termin);
}

function formatTerminBlock(label: string, termin: TerminBlock | BouraniBlock) {
  const lines: string[] = [];

  const oknoLabel = formatLogistikaOknoLabel(
    `${label} — možné v okně`,
    termin.oknoOd,
    termin.oknoDo
  );
  if (oknoLabel) lines.push(oknoLabel);

  const realizace = getTerminRealizaceRange(termin);
  const realizaceLabel = formatLogistikaOknoLabel(
    `${label} — domluvená realizace`,
    realizace.od,
    realizace.do
  );
  if (realizaceLabel) lines.push(realizaceLabel);

  if (termin.pristupOd) {
    lines.push(`${label} — přístup od: ${termin.pristupOd}`);
  }
  if (termin.omezeniVjezdu) {
    lines.push(`${label} — omezení vjezdu: ${termin.omezeniVjezdu}`);
  }
  if (termin.poznamka) {
    lines.push(`${label}: ${termin.poznamka}`);
  }
  if ("mistoUvolnenoDo" in termin && termin.mistoUvolnenoDo) {
    lines.push(`${label} — místo uvolněno do: ${termin.mistoUvolnenoDo}`);
  }

  return lines.join("\n");
}

export function buildPoznamkaFromSnapshot(
  snapshot: PoptavkaObjednavkaSnapshot,
  detail: InternalPoptavkaDetail
) {
  const lines: string[] = [
    `Zakázka vznikla z potvrzené závazné objednávky k poptávce ${snapshot.meta.cisloPoptavky}.`,
    `Snapshot objednávky: ${snapshot.frozenAt}${snapshot.meta.linkId ? ` (link ${snapshot.meta.linkId})` : ""}.`,
  ];

  if (snapshot.akce.typAkce || snapshot.akce.typAkcePoznamka) {
    lines.push(
      `Typ akce: ${snapshot.akce.typAkce ?? "—"}${snapshot.akce.typAkcePoznamka ? ` — ${snapshot.akce.typAkcePoznamka}` : ""}`
    );
  }

  if (snapshot.akce.poznamka) {
    lines.push(`Poznámka k akci / místu: ${snapshot.akce.poznamka}`);
  }

  const stavbaText = formatTerminBlock("Stavba", snapshot.organizace.stavba);
  if (stavbaText) {
    lines.push(stavbaText);
  }

  const bouraniText = formatTerminBlock("Bourání", snapshot.organizace.bourani);
  if (bouraniText) {
    lines.push(bouraniText);
  }

  if (snapshot.organizace.prijezdTechniky) {
    lines.push(`Příjezd techniky: ${snapshot.organizace.prijezdTechniky}`);
  }

  if (snapshot.organizace.soucinnostKlienta) {
    lines.push(`Součinnost klienta: ${snapshot.organizace.soucinnostKlienta}`);
  }

  if (snapshot.technickePlneni.poznamkaKTechnice) {
    lines.push(`Technika: ${snapshot.technickePlneni.poznamkaKTechnice}`);
  }

  for (const oblast of SETUP_OBLASTI) {
    const block = snapshot.technickePlneni.oblasti[oblast];
    if (!block?.popis && !block?.poznamka) continue;
    const label = SETUP_OBLAST_LABELS[oblast];
    if (block.popis) {
      lines.push(`${label} — plnění: ${block.popis}`);
    }
    if (block.poznamka) {
      lines.push(`${label} — poznámka: ${block.poznamka}`);
    }
  }

  const setupLines = snapshot.technickePlneni.setupy.map((row) => {
    const parts = [`${row.nazev} × ${row.mnozstvi}`];
    if (row.poznamkaKlienta) parts.push(`klient: ${row.poznamkaKlienta}`);
    if (row.poznamkaInterni) parts.push(`interní: ${row.poznamkaInterni}`);
    return parts.join(" — ");
  });

  if (setupLines.length > 0) {
    lines.push(`Setupy v objednávce:\n${setupLines.join("\n")}`);
  }

  if (detail.interni_poznamka) {
    lines.push(`Interní poznámka k poptávce: ${detail.interni_poznamka}`);
  }

  return lines.filter(Boolean).join("\n\n");
}

export function buildDotaznikPayloadFromSnapshot(
  snapshot: PoptavkaObjednavkaSnapshot,
  detail: InternalPoptavkaDetail,
  zakazkaId: string
) {
  const { misto, klient, organizace } = snapshot;
  const now = new Date().toISOString();

  return {
    zakazka_id: zakazkaId,
    link_id: null,
    stav: misto.pozadovanVyjezdTechnika ? "pozadovan_vyjezd_technika" : "prevzato_z_poptavky",
    kontakt_jmeno: klient.kontaktJmeno ?? detail.kontakt_jmeno,
    kontakt_telefon: klient.telefon ?? detail.kontakt_telefon,
    prijezd_poznamka: misto.prijezdPopis,
    parkovani_poznamka: misto.pristupovaCesta,
    elektro_pripojka: misto.elektro.pripojka,
    elektro_jisteni: misto.elektro.jisteni,
    elektro_zasuvka: misto.elektro.zasuvka,
    elektro_vzdalenost_m: misto.elektro.vzdalenostM,
    pozadovan_vyjezd_technika: misto.pozadovanVyjezdTechnika,
    potvrzeni_pravdivosti: false,
    potvrzeni_doctovani: false,
    rizika: [],
    odpovedi_extra: {
      zdroj: "objednavka_snapshot",
      poptavka_id: detail.poptavka_id,
      cislo_poptavky: snapshot.meta.cisloPoptavky,
      objednavka_link_id: snapshot.meta.linkId,
      snapshot_frozen_at: snapshot.frozenAt,
      rozvadece_poznamka: misto.elektro.rozvadecePoznamka,
      kabelove_trasy: misto.elektro.kabeloveTrasy,
      misto_stage: misto.mistoStage,
      misto_foh: misto.mistoFoh,
      misto_led_rezie: misto.mistoLedRezie,
      omezeni_hluku: misto.omezeniHluku,
      casova_omezeni: misto.casovaOmezeni,
      nocni_prace_omezeni: misto.nocniPraceOmezeni,
      kotveni_zaveseni: misto.kotveniZaveseni,
      pozadavky_poradatele: misto.pozadavkyPoradatele,
      dalsi_poznamky: misto.dalsiTechnickePoznamky,
      povrch_teren: misto.povrchTeren,
      vjezd_technikou: misto.vjezdTechnikou,
      kabel_pres_silnici: misto.elektro.kabelPresSilnici,
      potreba_elektrocentraly: misto.elektro.potrebaElektrocentraly,
      vzdalenost_rozvadece: misto.elektro.vzdalenostRozvadece,
      prijezd_techniky: organizace.prijezdTechniky,
      kontakt_email: klient.email ?? detail.kontakt_email,
    },
    submitted_at: now,
    updated_at: now,
  };
}

export type SnapshotZakazkaFields = {
  nazev: string;
  mistoText: string | null;
  mistoLat: number | null;
  mistoLng: number | null;
  akceOd: string;
  akceDo: string;
  stavbaOknoOd: string | null;
  stavbaOknoDo: string | null;
  bouraniOknoOd: string | null;
  bouraniOknoDo: string | null;
  stavbaOd: string | null;
  stavbaDo: string | null;
  bouraniOd: string | null;
  bouraniDo: string | null;
  poznamka: string;
};

export function buildZakazkaFieldsFromSnapshot(
  snapshot: PoptavkaObjednavkaSnapshot,
  detail: InternalPoptavkaDetail
): SnapshotZakazkaFields | { error: "missing_akce_datum" } {
  const { akceOd, akceDo } = combineAkceRangeFromSnapshot(snapshot);
  if (!akceOd || !akceDo) {
    return { error: "missing_akce_datum" };
  }

  const stavbaOkno = getTerminOknoRange(snapshot.organizace.stavba);
  const bouraniOkno = getTerminOknoRange(snapshot.organizace.bourani);
  const stavba = combineTerminRange(snapshot.organizace.stavba);
  const bourani = combineTerminRange(snapshot.organizace.bourani);

  const nazev =
    snapshot.akce.nazevAkce?.trim() ||
    snapshot.misto.nazev?.trim() ||
    snapshot.meta.cisloPoptavky;

  const mistoText =
    snapshot.misto.adresa?.trim() || snapshot.misto.nazev?.trim() || null;

  const mistoLat = snapshot.misto.gps.lat != null ? Number(snapshot.misto.gps.lat) : null;
  const mistoLng = snapshot.misto.gps.lng != null ? Number(snapshot.misto.gps.lng) : null;

  return {
    nazev,
    mistoText,
    mistoLat: Number.isFinite(mistoLat) ? mistoLat : null,
    mistoLng: Number.isFinite(mistoLng) ? mistoLng : null,
    akceOd,
    akceDo,
    stavbaOknoOd: stavbaOkno.od,
    stavbaOknoDo: stavbaOkno.do,
    bouraniOknoOd: bouraniOkno.od,
    bouraniOknoDo: bouraniOkno.do,
    stavbaOd: stavba.od,
    stavbaDo: stavba.do,
    bouraniOd: bourani.od,
    bouraniDo: bourani.do,
    poznamka: buildPoznamkaFromSnapshot(snapshot, detail),
  };
}

export function snapshotSetupRows(snapshot: PoptavkaObjednavkaSnapshot) {
  return snapshot.technickePlneni.setupy.map((row) => ({
    setupId: row.setupId,
    mnozstvi: row.mnozstvi,
  }));
}
