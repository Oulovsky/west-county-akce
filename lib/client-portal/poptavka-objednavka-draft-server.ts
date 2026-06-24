import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildPoptavkaObjednavkaDraftFromPoptavka,
  createEmptyPoptavkaObjednavkaDraftData,
  normalizePoptavkaObjednavkaDraftData,
  type BuildPoptavkaObjednavkaDraftOptions,
} from "@/lib/client-portal/poptavka-objednavka-draft";
import { POPTAVKA_OBJEDNAVKA_DRAFT_SCHEMA_VERSION } from "@/lib/client-portal/poptavka-objednavka-types";
import type { PoptavkaObjednavkaDraftData } from "@/lib/client-portal/poptavka-objednavka-types";

export type PoptavkaObjednavkaDraftStav =
  | "rozpracovano"
  | "pripraveno_k_odeslani"
  | "odeslano"
  | "archivovano";

export const ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY = [
  "rozpracovano",
  "pripraveno_k_odeslani",
] as const satisfies readonly PoptavkaObjednavkaDraftStav[];

export type PoptavkaObjednavkaDraftRow = {
  draft_id: string;
  poptavka_id: string;
  stav: PoptavkaObjednavkaDraftStav;
  draft_data: unknown;
  draft_schema_version: number;
  fakturacni_firma_id: string | null;
  based_on_poptavka_updated_at: string | null;
  prepared_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PoptavkaObjednavkaDraftWithData = Omit<PoptavkaObjednavkaDraftRow, "draft_data"> & {
  draftData: PoptavkaObjednavkaDraftData;
};

export type PoptavkaObjednavkaDraftContext = {
  sourceChanged: boolean;
  poptavkaUpdatedAt: string | null;
};

export type PoptavkaObjednavkaDraftLoaded = PoptavkaObjednavkaDraftWithData &
  PoptavkaObjednavkaDraftContext;

export type CreateOrLoadPoptavkaObjednavkaDraftOptions = BuildPoptavkaObjednavkaDraftOptions & {
  preparedByUserId?: string | null;
};

export type SavePoptavkaObjednavkaDraftResult =
  | { ok: true; draft: PoptavkaObjednavkaDraftLoaded }
  | {
      ok: false;
      error: "not_found" | "read_only" | "save_failed";
      message?: string;
    };

export type MarkPoptavkaObjednavkaDraftReadyResult =
  | { ok: true; draft: PoptavkaObjednavkaDraftLoaded }
  | {
      ok: false;
      error: "not_found" | "read_only" | "save_failed";
      message?: string;
    };

export type ArchivePoptavkaObjednavkaDraftResult =
  | { ok: true; draft: PoptavkaObjednavkaDraftWithData }
  | {
      ok: false;
      error: "not_found" | "save_failed";
      message?: string;
    };

const DRAFT_ROW_SELECT =
  "draft_id, poptavka_id, stav, draft_data, draft_schema_version, fakturacni_firma_id, based_on_poptavka_updated_at, prepared_by_user_id, created_at, updated_at" as const;

function isActiveDraftStav(stav: string): stav is (typeof ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY)[number] {
  return (ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY as readonly string[]).includes(stav);
}

function mergeDraftDataFromJson(raw: unknown): PoptavkaObjednavkaDraftData {
  const base = createEmptyPoptavkaObjednavkaDraftData();
  if (!raw || typeof raw !== "object") {
    return base;
  }

  const src = raw as Partial<PoptavkaObjednavkaDraftData>;

  return {
    ...base,
    ...src,
    klient: { ...base.klient, ...src.klient },
    dodavatel: { ...base.dodavatel, ...src.dodavatel },
    akce: { ...base.akce, ...src.akce },
    misto: {
      ...base.misto,
      ...src.misto,
      gps: { ...base.misto.gps, ...src.misto?.gps },
      elektro: { ...base.misto.elektro, ...src.misto?.elektro },
    },
    organizace: {
      ...base.organizace,
      ...src.organizace,
      stavba: { ...base.organizace.stavba, ...src.organizace?.stavba },
      bourani: { ...base.organizace.bourani, ...src.organizace?.bourani },
    },
    technickePlneni: {
      ...base.technickePlneni,
      ...src.technickePlneni,
      oblasti: { ...base.technickePlneni.oblasti, ...src.technickePlneni?.oblasti },
      setupy: src.technickePlneni?.setupy ?? base.technickePlneni.setupy,
    },
    smluvniPodminky: { ...base.smluvniPodminky, ...src.smluvniPodminky },
    textProKlienta: { ...base.textProKlienta, ...src.textProKlienta },
    fotky: src.fotky ?? base.fotky,
    pricing: null,
    validationWarnings: [],
  };
}

export function parsePoptavkaObjednavkaDraftData(raw: unknown): PoptavkaObjednavkaDraftData {
  return normalizePoptavkaObjednavkaDraftData(mergeDraftDataFromJson(raw));
}

function computeSourceChanged(
  basedOn: string | null | undefined,
  poptavkaUpdatedAt: string | null | undefined
): boolean {
  if (!basedOn || !poptavkaUpdatedAt) {
    return false;
  }

  return new Date(basedOn).getTime() < new Date(poptavkaUpdatedAt).getTime();
}

async function loadPoptavkaUpdatedAt(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("poptavky")
    .select("updated_at")
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.updated_at as string | null | undefined) ?? null;
}

function mapDraftRow(row: PoptavkaObjednavkaDraftRow): PoptavkaObjednavkaDraftWithData {
  return {
    draft_id: row.draft_id,
    poptavka_id: row.poptavka_id,
    stav: row.stav,
    draft_schema_version: row.draft_schema_version,
    fakturacni_firma_id: row.fakturacni_firma_id,
    based_on_poptavka_updated_at: row.based_on_poptavka_updated_at,
    prepared_by_user_id: row.prepared_by_user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    draftData: parsePoptavkaObjednavkaDraftData(row.draft_data),
  };
}

function withDraftContext(
  draft: PoptavkaObjednavkaDraftWithData,
  poptavkaUpdatedAt: string | null
): PoptavkaObjednavkaDraftLoaded {
  return {
    ...draft,
    poptavkaUpdatedAt,
    sourceChanged: computeSourceChanged(draft.based_on_poptavka_updated_at, poptavkaUpdatedAt),
  };
}

async function resolvePreparedByUserId(
  supabase: SupabaseClient,
  explicitUserId?: string | null
): Promise<string | null> {
  if (explicitUserId) {
    return explicitUserId;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

async function loadActiveDraftRow(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<PoptavkaObjednavkaDraftRow | null> {
  const { data, error } = await supabase
    .from("poptavka_objednavka_drafts")
    .select(DRAFT_ROW_SELECT)
    .eq("poptavka_id", poptavkaId)
    .in("stav", [...ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY])
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PoptavkaObjednavkaDraftRow | null) ?? null;
}

async function loadDraftRowById(
  supabase: SupabaseClient,
  draftId: string
): Promise<PoptavkaObjednavkaDraftRow | null> {
  const { data, error } = await supabase
    .from("poptavka_objednavka_drafts")
    .select(DRAFT_ROW_SELECT)
    .eq("draft_id", draftId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PoptavkaObjednavkaDraftRow | null) ?? null;
}

export async function loadPoptavkaObjednavkaDraft(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<PoptavkaObjednavkaDraftLoaded | null> {
  const [row, poptavkaUpdatedAt] = await Promise.all([
    loadActiveDraftRow(supabase, poptavkaId),
    loadPoptavkaUpdatedAt(supabase, poptavkaId),
  ]);

  if (!row) {
    return null;
  }

  return withDraftContext(mapDraftRow(row), poptavkaUpdatedAt);
}

export async function createOrLoadPoptavkaObjednavkaDraft(
  supabase: SupabaseClient,
  poptavkaId: string,
  options: CreateOrLoadPoptavkaObjednavkaDraftOptions = {}
): Promise<PoptavkaObjednavkaDraftLoaded | null> {
  const existing = await loadPoptavkaObjednavkaDraft(supabase, poptavkaId);
  if (existing) {
    return existing;
  }

  const [draftData, poptavkaUpdatedAt, preparedByUserId] = await Promise.all([
    buildPoptavkaObjednavkaDraftFromPoptavka(supabase, poptavkaId, options),
    loadPoptavkaUpdatedAt(supabase, poptavkaId),
    resolvePreparedByUserId(supabase, options.preparedByUserId),
  ]);

  if (!draftData) {
    return null;
  }

  const fakturacniFirmaId =
    options.fakturacniFirmaId ?? options.fakturacniFirma?.id ?? null;

  const { data, error } = await supabase
    .from("poptavka_objednavka_drafts")
    .insert({
      poptavka_id: poptavkaId,
      stav: "rozpracovano",
      draft_data: draftData,
      draft_schema_version: POPTAVKA_OBJEDNAVKA_DRAFT_SCHEMA_VERSION,
      fakturacni_firma_id: fakturacniFirmaId,
      based_on_poptavka_updated_at: poptavkaUpdatedAt,
      prepared_by_user_id: preparedByUserId,
    })
    .select(DRAFT_ROW_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return withDraftContext(mapDraftRow(data as PoptavkaObjednavkaDraftRow), poptavkaUpdatedAt);
}

export async function savePoptavkaObjednavkaDraft(
  supabase: SupabaseClient,
  draftId: string,
  draftData: PoptavkaObjednavkaDraftData
): Promise<SavePoptavkaObjednavkaDraftResult> {
  const row = await loadDraftRowById(supabase, draftId);
  if (!row) {
    return { ok: false, error: "not_found" };
  }

  if (!isActiveDraftStav(row.stav)) {
    return { ok: false, error: "read_only" };
  }

  const normalized = normalizePoptavkaObjednavkaDraftData(draftData);

  const { data, error } = await supabase
    .from("poptavka_objednavka_drafts")
    .update({
      draft_data: normalized,
      stav: "rozpracovano",
    })
    .eq("draft_id", draftId)
    .in("stav", [...ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY])
    .select(DRAFT_ROW_SELECT)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "save_failed", message: error.message };
  }

  if (!data) {
    return { ok: false, error: "read_only" };
  }

  const poptavkaUpdatedAt = await loadPoptavkaUpdatedAt(supabase, row.poptavka_id);

  return {
    ok: true,
    draft: withDraftContext(mapDraftRow(data as PoptavkaObjednavkaDraftRow), poptavkaUpdatedAt),
  };
}

export async function markPoptavkaObjednavkaDraftReady(
  supabase: SupabaseClient,
  draftId: string
): Promise<MarkPoptavkaObjednavkaDraftReadyResult> {
  const row = await loadDraftRowById(supabase, draftId);
  if (!row) {
    return { ok: false, error: "not_found" };
  }

  if (!isActiveDraftStav(row.stav)) {
    return { ok: false, error: "read_only" };
  }

  const normalized = parsePoptavkaObjednavkaDraftData(row.draft_data);

  const { data, error } = await supabase
    .from("poptavka_objednavka_drafts")
    .update({
      draft_data: normalized,
      stav: "pripraveno_k_odeslani",
    })
    .eq("draft_id", draftId)
    .in("stav", [...ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY])
    .select(DRAFT_ROW_SELECT)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "save_failed", message: error.message };
  }

  if (!data) {
    return { ok: false, error: "read_only" };
  }

  const poptavkaUpdatedAt = await loadPoptavkaUpdatedAt(supabase, row.poptavka_id);

  return {
    ok: true,
    draft: withDraftContext(mapDraftRow(data as PoptavkaObjednavkaDraftRow), poptavkaUpdatedAt),
  };
}

export async function archivePoptavkaObjednavkaDraft(
  supabase: SupabaseClient,
  draftId: string
): Promise<ArchivePoptavkaObjednavkaDraftResult> {
  const row = await loadDraftRowById(supabase, draftId);
  if (!row) {
    return { ok: false, error: "not_found" };
  }

  const { data, error } = await supabase
    .from("poptavka_objednavka_drafts")
    .update({ stav: "archivovano" })
    .eq("draft_id", draftId)
    .select(DRAFT_ROW_SELECT)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "save_failed", message: error.message };
  }

  if (!data) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true, draft: mapDraftRow(data as PoptavkaObjednavkaDraftRow) };
}
