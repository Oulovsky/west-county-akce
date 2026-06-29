import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import type {
  ClientPortalPreviousTechnikaOption,
  ClientPortalPreviousTechnikaSetupRow,
  ClientPortalPreviousTechnikaSourceKind,
} from "@/lib/client-portal/client-previous-technika-shared";
import { formatPoptavkaDateRange } from "@/lib/client-portal/poptavka-form";
import {
  hasSestavaKonfigurace,
  sestavaFromOdpovediExtra,
} from "@/lib/client-portal/sestava-konfigurator-form";
import { validatePoptavkaObjednavkaSnapshot } from "@/lib/client-portal/poptavka-objednavka-link-server";
import type { PoptavkaObjednavkaSnapshot } from "@/lib/client-portal/poptavka-objednavka-types";
import type { SestavaKonfiguratorState } from "@/lib/client-portal/sestava-konfigurator-types";
import type { SetupOblast } from "@/lib/client-portal/types";
import { isSetupOblast } from "@/lib/client-portal/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type { ClientPortalPreviousTechnikaOption } from "@/lib/client-portal/client-previous-technika-shared";

const PREVIOUS_TECHNIKA_OPTIONS_LIMIT = 5;
const POPTAVKA_CANDIDATE_LIMIT = 20;

type PortalSetupMeta = {
  setup_id: string;
  nazev: string;
  oblast: SetupOblast;
};

type PoptavkaCandidateRow = {
  poptavka_id: string;
  cislo_poptavky: string;
  misto_id: string | null;
  misto_nazev: string | null;
  misto_adresa: string | null;
  datum_od: string | null;
  datum_do: string | null;
  objednavka_potvrzena_at: string | null;
  stav: string;
  updated_at: string;
};

type FilterSetupsResult = {
  setupy: ClientPortalPreviousTechnikaSetupRow[];
  skippedCount: number;
  warnings: string[];
};

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function buildMistoLabel(row: Pick<PoptavkaCandidateRow, "misto_nazev" | "misto_adresa">) {
  return nullableText(row.misto_nazev) ?? nullableText(row.misto_adresa);
}

function buildDatumLabel(datumOd: string | null, datumDo: string | null) {
  return formatPoptavkaDateRange(datumOd, datumDo);
}

async function loadPortalSetupMetaMap(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("setupy")
    .select("setup_id, nazev, oblast")
    .eq("aktivni", true)
    .eq("dostupne_v_portalu", true);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, PortalSetupMeta>();
  for (const row of data ?? []) {
    const setupId = row.setup_id as string;
    const oblastRaw = row.oblast as string;
    map.set(setupId, {
      setup_id: setupId,
      nazev: (row.nazev as string) ?? setupId,
      oblast: isSetupOblast(oblastRaw) ? oblastRaw : "other",
    });
  }

  return map;
}

async function loadConfirmedSnapshotForPoptavka(
  poptavkaId: string
): Promise<PoptavkaObjednavkaSnapshot | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("poptavka_objednavka_links")
    .select("objednavka_snapshot")
    .eq("poptavka_id", poptavkaId)
    .is("revoked_at", null)
    .not("potvrzeno_at", "is", null)
    .eq("stav", "potvrzeno")
    .order("potvrzeno_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.objednavka_snapshot) {
    return null;
  }

  const validated = validatePoptavkaObjednavkaSnapshot(data.objednavka_snapshot, poptavkaId);
  return validated.ok ? validated.snapshot : null;
}

function filterSetupRowsForPortal(
  rows: Array<{
    setupId: string;
    nazev: string;
    oblast: SetupOblast;
    mnozstvi: number;
    poznamkaKlienta: string | null;
  }>,
  portalSetups: Map<string, PortalSetupMeta>
): FilterSetupsResult {
  const setupy: ClientPortalPreviousTechnikaSetupRow[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    const meta = portalSetups.get(row.setupId);
    if (!meta) {
      skippedCount += 1;
      continue;
    }

    setupy.push({
      setup_id: row.setupId,
      nazev: meta.nazev,
      oblast: meta.oblast,
      mnozstvi: Math.max(1, Math.floor(row.mnozstvi)),
      poznamka_klienta: nullableText(row.poznamkaKlienta),
    });
  }

  const warnings: string[] = [];
  if (skippedCount > 0) {
    warnings.push(
      skippedCount === 1
        ? "1 položka z předchozí akce už není v portálu dostupná a byla vynechána."
        : `${skippedCount} položek z předchozí akce už není v portálu dostupných a byly vynechány.`
    );
  }

  return { setupy, skippedCount, warnings };
}

function buildOptionFromSetups(params: {
  row: PoptavkaCandidateRow;
  sourceKind: ClientPortalPreviousTechnikaSourceKind;
  sourceLabel: string;
  akceNazev: string;
  datumOd: string | null;
  datumDo: string | null;
  mistoId: string | null;
  mistoLabel: string | null;
  filterResult: FilterSetupsResult;
  sestavaKonfigurator?: SestavaKonfiguratorState | null;
}): ClientPortalPreviousTechnikaOption | null {
  if (params.filterResult.setupy.length === 0) {
    return null;
  }

  const oblastSet = new Set<SetupOblast>();
  for (const setup of params.filterResult.setupy) {
    oblastSet.add(setup.oblast);
  }

  return {
    option_id: `${params.row.poptavka_id}:${params.sourceKind}`,
    poptavka_id: params.row.poptavka_id,
    source_kind: params.sourceKind,
    source_label: params.sourceLabel,
    akce_nazev: params.akceNazev,
    datum_label: buildDatumLabel(params.datumOd, params.datumDo),
    misto_id: params.mistoId,
    misto_label: params.mistoLabel,
    setupy: params.filterResult.setupy,
    oblast_badges: [...oblastSet],
    skipped_setup_count: params.filterResult.skippedCount,
    warnings: params.filterResult.warnings,
    sestava_konfigurator: params.sestavaKonfigurator ?? null,
  };
}

async function loadPoptavkaSetupRowsForFallback(
  supabase: SupabaseClient,
  poptavkaId: string,
  portalSetups: Map<string, PortalSetupMeta>
) {
  const { data, error } = await supabase
    .from("poptavka_setupy")
    .select(
      "setup_id, mnozstvi, poznamka_klienta, setup:setupy(setup_id, nazev, oblast)"
    )
    .eq("poptavka_id", poptavkaId)
    .order("poradi", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? [])
    .map((row) => {
      const setupRaw = row.setup;
      const setup = Array.isArray(setupRaw) ? setupRaw[0] : setupRaw;
      if (!setup?.setup_id) return null;
      const oblastRaw = setup.oblast as string;
      return {
        setupId: setup.setup_id as string,
        nazev: (setup.nazev as string) ?? setup.setup_id,
        oblast: isSetupOblast(oblastRaw) ? oblastRaw : ("other" as SetupOblast),
        mnozstvi: Math.max(1, Math.floor(Number(row.mnozstvi) || 1)),
        poznamkaKlienta: nullableText(row.poznamka_klienta as string | null),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return filterSetupRowsForPortal(rows, portalSetups);
}

async function loadSestavaKonfiguratorForPoptavka(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<SestavaKonfiguratorState | null> {
  const { data, error } = await supabase
    .from("poptavka_technicke_udaje")
    .select("odpovedi_extra")
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (error || !data?.odpovedi_extra) {
    return null;
  }

  const sestava = sestavaFromOdpovediExtra(data.odpovedi_extra as Record<string, unknown>);
  return hasSestavaKonfigurace(sestava) ? sestava : null;
}

async function buildOptionForCandidate(
  supabase: SupabaseClient,
  row: PoptavkaCandidateRow,
  portalSetups: Map<string, PortalSetupMeta>
): Promise<ClientPortalPreviousTechnikaOption | null> {
  const mistoLabel = buildMistoLabel(row);
  const sestavaKonfigurator = await loadSestavaKonfiguratorForPoptavka(supabase, row.poptavka_id);

  if (row.objednavka_potvrzena_at) {
    const snapshot = await loadConfirmedSnapshotForPoptavka(row.poptavka_id);
    if (snapshot) {
      const snapshotRows = snapshot.technickePlneni.setupy.map((setup) => ({
        setupId: setup.setupId,
        nazev: setup.nazev,
        oblast: setup.oblast,
        mnozstvi: setup.mnozstvi,
        poznamkaKlienta: setup.poznamkaKlienta,
      }));

      const filterResult = filterSetupRowsForPortal(snapshotRows, portalSetups);
      const option = buildOptionFromSetups({
        row,
        sourceKind: "confirmed_order",
        sourceLabel: "Potvrzená objednávka",
        akceNazev:
          nullableText(snapshot.akce.nazevAkce) ??
          nullableText(row.misto_nazev) ??
          row.cislo_poptavky,
        datumOd: snapshot.akce.datumOd ?? row.datum_od,
        datumDo: snapshot.akce.datumDo ?? row.datum_do,
        mistoId: row.misto_id,
        mistoLabel: nullableText(snapshot.misto.nazev) ?? nullableText(snapshot.misto.adresa) ?? mistoLabel,
        filterResult,
        sestavaKonfigurator,
      });

      if (option) {
        return option;
      }
    }

    const fallbackResult = await loadPoptavkaSetupRowsForFallback(
      supabase,
      row.poptavka_id,
      portalSetups
    );
    return buildOptionFromSetups({
      row,
      sourceKind: "previous_poptavka",
      sourceLabel: "Předchozí poptávka (bez použitelného snapshotu objednávky)",
      akceNazev: nullableText(row.misto_nazev) ?? row.cislo_poptavky,
      datumOd: row.datum_od,
      datumDo: row.datum_do,
      mistoId: row.misto_id,
      mistoLabel,
      filterResult: fallbackResult,
      sestavaKonfigurator,
    });
  }

  const fallbackResult = await loadPoptavkaSetupRowsForFallback(
    supabase,
    row.poptavka_id,
    portalSetups
  );

  return buildOptionFromSetups({
    row,
    sourceKind: "previous_poptavka",
    sourceLabel: "Předchozí poptávka (bez potvrzené objednávky)",
    akceNazev: nullableText(row.misto_nazev) ?? row.cislo_poptavky,
    datumOd: row.datum_od,
    datumDo: row.datum_do,
    mistoId: row.misto_id,
    mistoLabel,
    filterResult: fallbackResult,
    sestavaKonfigurator,
  });
}

async function loadPoptavkaCandidates(
  supabase: SupabaseClient,
  klientId: string,
  excludePoptavkaId?: string
) {
  const { data, error } = await supabase
    .from("poptavky")
    .select(
      "poptavka_id, cislo_poptavky, misto_id, misto_nazev, misto_adresa, datum_od, datum_do, objednavka_potvrzena_at, stav, updated_at"
    )
    .eq("klient_id", klientId)
    .order("objednavka_potvrzena_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(POPTAVKA_CANDIDATE_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as PoptavkaCandidateRow[]).filter(
    (row) =>
      row.poptavka_id !== excludePoptavkaId &&
      row.stav !== "zamitnuta" &&
      row.stav !== "objednavka_odmitnuta"
  );
}

export async function loadClientPreviousTechnikaOptionsForPortal(
  supabase: SupabaseClient,
  options?: { excludePoptavkaId?: string; mistoId?: string | null }
): Promise<ClientPortalPreviousTechnikaOption[]> {
  const session = await requireActiveClientPortalSession(supabase);
  const klientId = session.account.klient_id!;

  const [portalSetups, candidates] = await Promise.all([
    loadPortalSetupMetaMap(supabase),
    loadPoptavkaCandidates(supabase, klientId, options?.excludePoptavkaId),
  ]);

  const mistoFilter = options?.mistoId?.trim() || null;
  const result: ClientPortalPreviousTechnikaOption[] = [];
  const seenPoptavkaIds = new Set<string>();

  for (const candidate of candidates) {
    if (mistoFilter && candidate.misto_id !== mistoFilter) {
      continue;
    }

    if (seenPoptavkaIds.has(candidate.poptavka_id)) {
      continue;
    }

    const option = await buildOptionForCandidate(supabase, candidate, portalSetups);
    if (!option) {
      continue;
    }

    seenPoptavkaIds.add(candidate.poptavka_id);
    result.push(option);

    if (result.length >= PREVIOUS_TECHNIKA_OPTIONS_LIMIT) {
      break;
    }
  }

  return result;
}

/** Načte návrhy sestavy / setupů z minulých akcí — volitelně jen pro dané místo. */
export const loadClientPreviousSetupOptionsForPortal = loadClientPreviousTechnikaOptionsForPortal;
