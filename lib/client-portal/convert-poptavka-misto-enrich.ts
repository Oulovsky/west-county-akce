import "server-only";

import { SETUP_OBLAST_LABELS } from "@/lib/client-portal/labels";
import type {
  PoptavkaObjednavkaSnapshot,
  PoptavkaObjednavkaTriVolba,
} from "@/lib/client-portal/poptavka-objednavka-types";
import { promotePoptavkaFotkyToMisto } from "@/lib/client-portal/convert-poptavka-misto-fotky";
import { SETUP_OBLASTI } from "@/lib/client-portal/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ConvertEnrichContext =
  | {
      mode: "snapshot";
      snapshot: PoptavkaObjednavkaSnapshot;
      objednavkaLinkId: string;
      snapshotFotkaIds: string[] | null;
    }
  | {
      mode: "legacy";
      snapshotFotkaIds?: null;
    };

function appendLine(lines: string[], label: string, value: string | number | null | undefined) {
  if (value == null) return;
  const text = String(value).trim();
  if (!text) return;
  lines.push(`${label}: ${text}`);
}

function formatTriVolba(value: PoptavkaObjednavkaTriVolba | null | undefined) {
  if (!value) return null;
  if (value === "ano") return "Ano";
  if (value === "ne") return "Ne";
  return "Nevím";
}

function buildTechnickaRevizeText(snapshot: PoptavkaObjednavkaSnapshot) {
  const { meta, akce, misto, organizace, technickePlneni } = snapshot;
  const lines: string[] = [
    `Technická revize místa z potvrzené závazné objednávky.`,
    `Poptávka: ${meta.cisloPoptavky}`,
    `Snapshot objednávky: ${snapshot.frozenAt}${meta.linkId ? ` (link ${meta.linkId})` : ""}`,
  ];

  appendLine(lines, "Název akce", akce.nazevAkce);
  if (akce.datumOd) {
    const datum =
      akce.datumDo && akce.datumDo !== akce.datumOd
        ? `${akce.datumOd} – ${akce.datumDo}`
        : akce.datumOd;
    appendLine(lines, "Datum akce", datum);
  }
  if (akce.casProgramuOd || akce.casProgramuDo) {
    appendLine(
      lines,
      "Čas programu",
      `${akce.casProgramuOd ?? "?"} – ${akce.casProgramuDo ?? "?"}`
    );
  }

  appendLine(lines, "Místo", misto.nazev);
  appendLine(lines, "Adresa", misto.adresa);
  if (misto.gps.lat != null && misto.gps.lng != null) {
    appendLine(lines, "GPS", `${misto.gps.lat}, ${misto.gps.lng}`);
  }

  appendLine(lines, "Příjezd", misto.prijezdPopis);
  appendLine(lines, "Přístupová cesta", misto.pristupovaCesta);
  appendLine(lines, "Povrch / terén", formatTriVolba(misto.povrchTeren));
  appendLine(lines, "Vjezd technikou", formatTriVolba(misto.vjezdTechnikou));

  appendLine(lines, "Elektro přípojka", misto.elektro.pripojka);
  appendLine(lines, "Jištění", misto.elektro.jisteni);
  appendLine(lines, "Zásuvka", misto.elektro.zasuvka);
  appendLine(lines, "Vzdálenost elektro (m)", misto.elektro.vzdalenostM);
  appendLine(lines, "Rozvaděč", misto.elektro.rozvadecePoznamka);
  appendLine(lines, "Kabelové trasy", misto.elektro.kabeloveTrasy);
  appendLine(lines, "Kabel přes silnici", formatTriVolba(misto.elektro.kabelPresSilnici));
  appendLine(
    lines,
    "Potřeba elektrocentrály",
    formatTriVolba(misto.elektro.potrebaElektrocentraly)
  );
  appendLine(lines, "Vzdálenost rozvaděče", misto.elektro.vzdalenostRozvadece);

  appendLine(lines, "Stage pozice", misto.mistoStage);
  appendLine(lines, "FOH pozice", misto.mistoFoh);
  appendLine(lines, "LED / režie pozice", misto.mistoLedRezie);

  appendLine(lines, "Hluková omezení", misto.omezeniHluku);
  appendLine(lines, "Časová omezení", misto.casovaOmezeni);
  appendLine(lines, "Noční práce / omezení", misto.nocniPraceOmezeni);
  appendLine(lines, "Kotvení / zavěšení", misto.kotveniZaveseni);
  appendLine(lines, "Požadavky pořadatele", misto.pozadavkyPoradatele);
  appendLine(lines, "Další technické poznámky", misto.dalsiTechnickePoznamky);

  const stavba = organizace.stavba;
  if (stavba.datum || stavba.poznamka) {
    lines.push("");
    lines.push("Stavba:");
    appendLine(lines, "  Datum", stavba.datum);
    if (stavba.casOd || stavba.casDo) {
      appendLine(lines, "  Čas", `${stavba.casOd ?? "?"} – ${stavba.casDo ?? "?"}`);
    }
    appendLine(lines, "  Přístup od", stavba.pristupOd);
    appendLine(lines, "  Omezení vjezdu", stavba.omezeniVjezdu);
    appendLine(lines, "  Poznámka", stavba.poznamka);
  }

  const bourani = organizace.bourani;
  if (bourani.datum || bourani.poznamka) {
    lines.push("");
    lines.push("Bourání:");
    appendLine(lines, "  Datum", bourani.datum);
    if (bourani.casOd || bourani.casDo) {
      appendLine(lines, "  Čas", `${bourani.casOd ?? "?"} – ${bourani.casDo ?? "?"}`);
    }
    appendLine(lines, "  Místo uvolněno do", bourani.mistoUvolnenoDo);
    appendLine(lines, "  Poznámka", bourani.poznamka);
  }

  appendLine(lines, "Příjezd techniky", organizace.prijezdTechniky);
  appendLine(lines, "Poznámka k technice", technickePlneni.poznamkaKTechnice);

  for (const oblast of SETUP_OBLASTI) {
    const block = technickePlneni.oblasti[oblast];
    if (!block?.popis && !block?.poznamka) continue;
    const label = SETUP_OBLAST_LABELS[oblast];
    appendLine(lines, `${label} — plnění`, block.popis);
    appendLine(lines, `${label} — poznámka`, block.poznamka);
  }

  const setupLines = technickePlneni.setupy.map((row) => {
    const parts = [`${row.nazev} × ${row.mnozstvi}`];
    if (row.poznamkaKlienta) parts.push(`klient: ${row.poznamkaKlienta}`);
    if (row.poznamkaInterni) parts.push(`interní: ${row.poznamkaInterni}`);
    return parts.join(" — ");
  });

  if (setupLines.length > 0) {
    lines.push("");
    lines.push("Setupy v objednávce:");
    lines.push(setupLines.join("\n"));
  }

  return lines.filter(Boolean).join("\n");
}

export type InsertMistoTechnickaRevizeResult =
  | { ok: true; skipped?: boolean; id?: string }
  | { ok: false; message: string };

export async function insertMistoTechnickaRevizeZeSnapshotu(
  supabase: SupabaseClient,
  params: {
    mistoId: string;
    poptavkaId: string;
    zakazkaId: string;
    snapshot: PoptavkaObjednavkaSnapshot;
    objednavkaLinkId: string;
  }
): Promise<InsertMistoTechnickaRevizeResult> {
  const { mistoId, poptavkaId, zakazkaId, snapshot, objednavkaLinkId } = params;

  const { data: existing, error: existingError } = await supabase
    .from("misto_technicke_poznamky")
    .select("id")
    .eq("misto_id", mistoId)
    .eq("source_objednavka_link_id", objednavkaLinkId)
    .maybeSingle();

  if (existingError) {
    return { ok: false, message: existingError.message };
  }

  if (existing?.id) {
    return { ok: true, skipped: true, id: existing.id as string };
  }

  const text = buildTechnickaRevizeText(snapshot);
  const now = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("misto_technicke_poznamky")
    .insert({
      misto_id: mistoId,
      zakazka_id: zakazkaId,
      autor_id: null,
      typ: "revize_objednavka",
      text,
      dulezite: true,
      source_poptavka_id: poptavkaId,
      source_objednavka_link_id: objednavkaLinkId,
      source_zakazka_id: zakazkaId,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    return { ok: false, message: insertError?.message ?? "insert_failed" };
  }

  return { ok: true, id: inserted.id as string };
}

export type EnrichMistoAfterPoptavkaConvertResult = {
  ok: boolean;
  warnings: string[];
};

export async function enrichMistoAfterPoptavkaConvert(
  supabase: SupabaseClient,
  params: {
    mistoId: string;
    poptavkaId: string;
    zakazkaId: string;
    enrich: ConvertEnrichContext;
  }
): Promise<EnrichMistoAfterPoptavkaConvertResult> {
  const warnings: string[] = [];

  if (params.enrich.mode === "snapshot") {
    const noteResult = await insertMistoTechnickaRevizeZeSnapshotu(supabase, {
      mistoId: params.mistoId,
      poptavkaId: params.poptavkaId,
      zakazkaId: params.zakazkaId,
      snapshot: params.enrich.snapshot,
      objednavkaLinkId: params.enrich.objednavkaLinkId,
    });

    if (!noteResult.ok) {
      warnings.push(`Technická revize místa: ${noteResult.message}`);
    }
  }

  const fotoResult = await promotePoptavkaFotkyToMisto(supabase, {
    mistoId: params.mistoId,
    poptavkaId: params.poptavkaId,
    zakazkaId: params.zakazkaId,
    snapshotFotkaIds: params.enrich.mode === "snapshot" ? params.enrich.snapshotFotkaIds : null,
  });

  if (!fotoResult.ok) {
    warnings.push(fotoResult.message ?? "Připojení fotek k místu selhalo.");
  } else if (fotoResult.failed > 0) {
    warnings.push(`Nepodařilo se připojit ${fotoResult.failed} fotek k místu.`);
  }

  return { ok: warnings.length === 0, warnings };
}
