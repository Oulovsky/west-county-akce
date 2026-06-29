import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import type { ClientPortalPreviousTechnikaProfileOption } from "@/lib/client-portal/client-previous-technika-profiles-shared";
import { formatPoptavkaDateRange } from "@/lib/client-portal/poptavka-form";
import {
  buildTechnikaSummaryBrief,
  hasTechnikaFormContent,
  technikaFromRecord,
} from "@/lib/client-portal/poptavka-technika-form";
import type { PoptavkaTechnickeUdaje } from "@/lib/client-portal/types";

export type { ClientPortalPreviousTechnikaProfileOption } from "@/lib/client-portal/client-previous-technika-profiles-shared";

const PROFILE_OPTIONS_LIMIT = 15;
const POPTAVKA_CANDIDATE_LIMIT = 25;

const TECHNIKA_FOTKA_TYPY = new Set([
  "rozvadec",
  "prijezd",
  "plocha_stage",
  "povrch_pristup",
  "jina",
  "misto_akce",
]);

type PoptavkaCandidateRow = {
  poptavka_id: string;
  cislo_poptavky: string;
  misto_id: string | null;
  misto_nazev: string | null;
  misto_adresa: string | null;
  datum_od: string | null;
  datum_do: string | null;
  stav: string;
  updated_at: string;
};

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function buildMistoLabel(row: Pick<PoptavkaCandidateRow, "misto_nazev" | "misto_adresa">) {
  return nullableText(row.misto_nazev) ?? nullableText(row.misto_adresa);
}

function buildAkceNazev(row: PoptavkaCandidateRow) {
  return nullableText(row.misto_nazev) ?? row.cislo_poptavky;
}

async function loadPoptavkaCandidates(
  supabase: SupabaseClient,
  klientId: string,
  excludePoptavkaId?: string
) {
  const { data, error } = await supabase
    .from("poptavky")
    .select(
      "poptavka_id, cislo_poptavky, misto_id, misto_nazev, misto_adresa, datum_od, datum_do, stav, updated_at"
    )
    .eq("klient_id", klientId)
    .neq("stav", "koncept")
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

async function loadTechnikaByPoptavkaIds(supabase: SupabaseClient, poptavkaIds: string[]) {
  if (poptavkaIds.length === 0) return new Map<string, PoptavkaTechnickeUdaje>();

  const { data, error } = await supabase
    .from("poptavka_technicke_udaje")
    .select("*")
    .in("poptavka_id", poptavkaIds);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, PoptavkaTechnickeUdaje>();
  for (const row of data ?? []) {
    map.set(row.poptavka_id as string, row as PoptavkaTechnickeUdaje);
  }
  return map;
}

async function loadTechnikaPhotoCounts(supabase: SupabaseClient, poptavkaIds: string[]) {
  if (poptavkaIds.length === 0) return new Map<string, number>();

  const { data, error } = await supabase
    .from("poptavka_fotky")
    .select("poptavka_id, typ")
    .in("poptavka_id", poptavkaIds);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const typ = row.typ as string;
    if (!TECHNIKA_FOTKA_TYPY.has(typ)) continue;
    const poptavkaId = row.poptavka_id as string;
    map.set(poptavkaId, (map.get(poptavkaId) ?? 0) + 1);
  }
  return map;
}

export async function loadClientPreviousTechnikaProfileOptionsForPortal(
  supabase: SupabaseClient,
  options?: { excludePoptavkaId?: string }
): Promise<ClientPortalPreviousTechnikaProfileOption[]> {
  const session = await requireActiveClientPortalSession(supabase);
  const klientId = session.account.klient_id!;

  const candidates = await loadPoptavkaCandidates(supabase, klientId, options?.excludePoptavkaId);
  const poptavkaIds = candidates.map((row) => row.poptavka_id);

  const [technikaById, photoCounts] = await Promise.all([
    loadTechnikaByPoptavkaIds(supabase, poptavkaIds),
    loadTechnikaPhotoCounts(supabase, poptavkaIds),
  ]);

  const result: ClientPortalPreviousTechnikaProfileOption[] = [];

  for (const row of candidates) {
    const technikaRow = technikaById.get(row.poptavka_id);
    if (!technikaRow) continue;

    const technikaValues = technikaFromRecord(technikaRow);
    if (!hasTechnikaFormContent(technikaValues)) continue;

    const photoCount = photoCounts.get(row.poptavka_id) ?? 0;

    result.push({
      option_id: `history:${row.poptavka_id}`,
      poptavka_id: row.poptavka_id,
      akce_nazev: buildAkceNazev(row),
      datum_label: formatPoptavkaDateRange(row.datum_od, row.datum_do),
      misto_id: row.misto_id,
      misto_label: buildMistoLabel(row),
      technika_summary: buildTechnikaSummaryBrief(technikaValues),
      technika_values: technikaValues,
      photo_count: photoCount,
      has_photos: photoCount > 0,
    });

    if (result.length >= PROFILE_OPTIONS_LIMIT) {
      break;
    }
  }

  return result;
}
