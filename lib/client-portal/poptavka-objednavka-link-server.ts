import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createClientApprovalToken,
  hashClientApprovalToken,
} from "@/lib/client-approval";
import { normalizeBaseUrl } from "@/lib/client-questionnaire";
import {
  draftToPoptavkaObjednavkaSnapshot,
  normalizePoptavkaObjednavkaDraftData,
} from "@/lib/client-portal/poptavka-objednavka-draft";
import {
  ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY,
  loadActiveDraftRow,
  loadDraftRowById,
  parsePoptavkaObjednavkaDraftData,
  resolveDraftFotkaSignedUrls,
  type PoptavkaObjednavkaDraftRow,
} from "@/lib/client-portal/poptavka-objednavka-draft-server";
import {
  POPTAVKA_OBJEDNAVKA_SNAPSHOT_SCHEMA_VERSION,
  POPTAVKA_OBJEDNAVKA_SNAPSHOT_VERSION,
  type PoptavkaObjednavkaSnapshot,
} from "@/lib/client-portal/poptavka-objednavka-types";
import type { PoptavkaStav } from "@/lib/client-portal/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type PoptavkaObjednavkaLinkStav =
  | "vytvoren"
  | "email_odeslan"
  | "potvrzeno"
  | "odmitnuto"
  | "revoked"
  | "email_error";

export type PoptavkaObjednavkaLinkRow = {
  link_id: string;
  poptavka_id: string;
  klient_id: string | null;
  draft_id: string | null;
  token_hash: string;
  email_to: string | null;
  stav: PoptavkaObjednavkaLinkStav;
  objednavka_snapshot: PoptavkaObjednavkaSnapshot;
  objednavka_snapshot_created_at: string | null;
  snapshot_schema_version: number;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  email_sent_at: string | null;
  opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  potvrzeno_at: string | null;
  odmitnuto_at: string | null;
};

export type PoptavkaObjednavkaLinkPoptavkaSummary = {
  poptavka_id: string;
  cislo_poptavky: string;
  stav: PoptavkaStav;
  klient_id: string | null;
  misto_nazev: string | null;
};

export type CreatePoptavkaObjednavkaLinkFromDraftOptions = {
  draftId?: string;
  emailTo?: string | null;
  baseUrl?: string | null;
  /** Výchozí 30 dní. */
  expiresInDays?: number;
  preparedByUserId?: string | null;
};

export type CreatePoptavkaObjednavkaLinkFromDraftResult =
  | {
      ok: true;
      link: PoptavkaObjednavkaLinkRow;
      rawToken: string;
      relativeUrl: string;
      publicUrl: string | null;
      snapshot: PoptavkaObjednavkaSnapshot;
    }
  | {
      ok: false;
      error:
        | "poptavka_not_found"
        | "draft_not_found"
        | "draft_poptavka_mismatch"
        | "draft_not_active"
        | "revoke_failed"
        | "link_insert_failed"
        | "draft_update_failed"
        | "poptavka_update_failed";
      message?: string;
    };

export type LoadPoptavkaObjednavkaLinkByTokenResult =
  | {
      ok: true;
      link: PoptavkaObjednavkaLinkRow;
      snapshot: PoptavkaObjednavkaSnapshot;
      poptavka: PoptavkaObjednavkaLinkPoptavkaSummary;
    }
  | {
      ok: false;
      error:
        | "invalid_token"
        | "revoked"
        | "expired"
        | "poptavka_state_invalid"
        | "snapshot_invalid";
    };

export type MarkPoptavkaObjednavkaLinkOpenedResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "update_failed"; message?: string };

const DEFAULT_EXPIRES_IN_DAYS = 30;

const LINK_ROW_SELECT =
  "link_id, poptavka_id, klient_id, draft_id, token_hash, email_to, stav, objednavka_snapshot, objednavka_snapshot_created_at, snapshot_schema_version, created_at, expires_at, revoked_at, email_sent_at, opened_at, last_opened_at, open_count, potvrzeno_at, odmitnuto_at" as const;

const TOKEN_VIEW_POPTAVKA_STAVY = [
  "objednavka_odeslana",
  "objednavka_potvrzena",
  "objednavka_odmitnuta",
] as const satisfies readonly PoptavkaStav[];

function isTokenViewPoptavkaStav(stav: string): stav is (typeof TOKEN_VIEW_POPTAVKA_STAVY)[number] {
  return (TOKEN_VIEW_POPTAVKA_STAVY as readonly string[]).includes(stav);
}

function isActiveDraftStav(stav: string): boolean {
  return (ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY as readonly string[]).includes(stav);
}

export function buildPoptavkaObjednavkaRelativeUrl(rawToken: string) {
  return `/poptavka-objednavka/${encodeURIComponent(rawToken)}`;
}

export function buildPoptavkaObjednavkaUrl(baseUrl: string, rawToken: string) {
  return `${normalizeBaseUrl(baseUrl)}${buildPoptavkaObjednavkaRelativeUrl(rawToken)}`;
}

function addDaysIso(days: number, from = new Date()) {
  const expires = new Date(from.getTime());
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires.toISOString();
}

function parseSnapshot(raw: unknown): PoptavkaObjednavkaSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const snapshot = raw as Partial<PoptavkaObjednavkaSnapshot>;
  if (snapshot.version !== POPTAVKA_OBJEDNAVKA_SNAPSHOT_VERSION) {
    return null;
  }

  if (!snapshot.meta?.poptavkaId || !snapshot.meta?.cisloPoptavky || !snapshot.meta?.linkId) {
    return null;
  }

  return snapshot as PoptavkaObjednavkaSnapshot;
}

function mapLinkRow(row: Record<string, unknown>): PoptavkaObjednavkaLinkRow {
  const snapshot = parseSnapshot(row.objednavka_snapshot) ?? (row.objednavka_snapshot as PoptavkaObjednavkaSnapshot);

  return {
    link_id: row.link_id as string,
    poptavka_id: row.poptavka_id as string,
    klient_id: (row.klient_id as string | null | undefined) ?? null,
    draft_id: (row.draft_id as string | null | undefined) ?? null,
    token_hash: row.token_hash as string,
    email_to: (row.email_to as string | null | undefined) ?? null,
    stav: row.stav as PoptavkaObjednavkaLinkStav,
    objednavka_snapshot: snapshot,
    objednavka_snapshot_created_at:
      (row.objednavka_snapshot_created_at as string | null | undefined) ?? null,
    snapshot_schema_version: row.snapshot_schema_version as number,
    created_at: row.created_at as string,
    expires_at: (row.expires_at as string | null | undefined) ?? null,
    revoked_at: (row.revoked_at as string | null | undefined) ?? null,
    email_sent_at: (row.email_sent_at as string | null | undefined) ?? null,
    opened_at: (row.opened_at as string | null | undefined) ?? null,
    last_opened_at: (row.last_opened_at as string | null | undefined) ?? null,
    open_count: (row.open_count as number | null | undefined) ?? 0,
    potvrzeno_at: (row.potvrzeno_at as string | null | undefined) ?? null,
    odmitnuto_at: (row.odmitnuto_at as string | null | undefined) ?? null,
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

async function loadDraftForSend(
  supabase: SupabaseClient,
  poptavkaId: string,
  draftId?: string
): Promise<PoptavkaObjednavkaDraftRow | null> {
  if (draftId) {
    const row = await loadDraftRowById(supabase, draftId);
    if (!row || row.poptavka_id !== poptavkaId) {
      return null;
    }
    return row;
  }

  return loadActiveDraftRow(supabase, poptavkaId);
}

async function resolveEmailTo(
  supabase: SupabaseClient,
  poptavka: {
    klient_id: string | null;
    kontakt_email: string | null;
  },
  draftEmail: string | null,
  explicitEmail?: string | null
): Promise<string | null> {
  const trimmedExplicit = explicitEmail?.trim();
  if (trimmedExplicit) {
    return trimmedExplicit;
  }

  const trimmedDraft = draftEmail?.trim();
  if (trimmedDraft) {
    return trimmedDraft;
  }

  const trimmedKontakt = poptavka.kontakt_email?.trim();
  if (trimmedKontakt) {
    return trimmedKontakt;
  }

  if (!poptavka.klient_id) {
    return null;
  }

  const { data, error } = await supabase
    .from("klienti")
    .select("email")
    .eq("klient_id", poptavka.klient_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.email?.trim() ?? null;
}

/**
 * Z aktivního draftu vytvoří immutable snapshot v `poptavka_objednavka_links`
 * a přepne workflow poptávky na `objednavka_odeslana`.
 *
 * Operace je sekvenční (bez DB RPC). Při selhání po revokaci starých linků
 * může poptávka krátce zůstat bez aktivního odkazu — stejné riziko jako u
 * `zakazka_approval_links`.
 */
export async function createPoptavkaObjednavkaLinkFromDraft(
  supabase: SupabaseClient,
  poptavkaId: string,
  options: CreatePoptavkaObjednavkaLinkFromDraftOptions = {}
): Promise<CreatePoptavkaObjednavkaLinkFromDraftResult> {
  const expiresInDays = options.expiresInDays ?? DEFAULT_EXPIRES_IN_DAYS;

  const { data: poptavka, error: poptavkaError } = await supabase
    .from("poptavky")
    .select("poptavka_id, cislo_poptavky, klient_id, kontakt_email, updated_at, stav")
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (poptavkaError) {
    return { ok: false, error: "poptavka_not_found", message: poptavkaError.message };
  }

  if (!poptavka) {
    return { ok: false, error: "poptavka_not_found" };
  }

  const draftRow = await loadDraftForSend(supabase, poptavkaId, options.draftId);
  if (!draftRow) {
    return { ok: false, error: options.draftId ? "draft_poptavka_mismatch" : "draft_not_found" };
  }

  if (draftRow.poptavka_id !== poptavkaId) {
    return { ok: false, error: "draft_poptavka_mismatch" };
  }

  if (!isActiveDraftStav(draftRow.stav)) {
    return { ok: false, error: "draft_not_active" };
  }

  const normalizedDraft = normalizePoptavkaObjednavkaDraftData(
    parsePoptavkaObjednavkaDraftData(draftRow.draft_data)
  );
  const preparedByUserId = await resolvePreparedByUserId(supabase, options.preparedByUserId);
  const emailTo = await resolveEmailTo(
    supabase,
    poptavka,
    normalizedDraft.klient.email,
    options.emailTo
  );

  const now = new Date().toISOString();
  const linkId = randomUUID();
  const rawToken = createClientApprovalToken();
  const tokenHash = hashClientApprovalToken(rawToken);
  const expiresAt = addDaysIso(expiresInDays);

  const fotkaSignedSeconds = Math.max(expiresInDays, 1) * 24 * 60 * 60;
  const fotkaPublicUrls = await resolveDraftFotkaSignedUrls(
    normalizedDraft.fotky,
    fotkaSignedSeconds
  );

  const snapshot = draftToPoptavkaObjednavkaSnapshot({
    draft: normalizedDraft,
    draftId: draftRow.draft_id,
    linkId,
    meta: {
      poptavkaId,
      cisloPoptavky: poptavka.cislo_poptavky,
    },
    sources: {
      poptavkaUpdatedAt: (poptavka.updated_at as string | null | undefined) ?? null,
      draftUpdatedAt: draftRow.updated_at,
      preparedByUserId,
    },
    fotkaPublicUrls,
    frozenAt: now,
    draftSchemaVersion: draftRow.draft_schema_version,
    snapshotSchemaVersion: POPTAVKA_OBJEDNAVKA_SNAPSHOT_SCHEMA_VERSION,
  });

  const { error: revokeError } = await supabase
    .from("poptavka_objednavka_links")
    .update({ revoked_at: now, stav: "revoked" })
    .eq("poptavka_id", poptavkaId)
    .is("revoked_at", null);

  if (revokeError) {
    return { ok: false, error: "revoke_failed", message: revokeError.message };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("poptavka_objednavka_links")
    .insert({
      link_id: linkId,
      poptavka_id: poptavkaId,
      klient_id: poptavka.klient_id,
      draft_id: draftRow.draft_id,
      token_hash: tokenHash,
      email_to: emailTo,
      stav: "vytvoren",
      objednavka_snapshot: snapshot,
      objednavka_snapshot_created_at: now,
      snapshot_schema_version: POPTAVKA_OBJEDNAVKA_SNAPSHOT_SCHEMA_VERSION,
      expires_at: expiresAt,
    })
    .select(LINK_ROW_SELECT)
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: "link_insert_failed",
      message: insertError?.message ?? "insert_failed",
    };
  }

  const { data: updatedDraft, error: draftUpdateError } = await supabase
    .from("poptavka_objednavka_drafts")
    .update({ stav: "odeslano" })
    .eq("draft_id", draftRow.draft_id)
    .in("stav", [...ACTIVE_POPTAVKA_OBJEDNAVKA_DRAFT_STAVY])
    .select("draft_id")
    .maybeSingle();

  if (draftUpdateError || !updatedDraft) {
    return {
      ok: false,
      error: "draft_update_failed",
      message: draftUpdateError?.message ?? "draft_not_updated",
    };
  }

  const { data: updatedPoptavka, error: poptavkaUpdateError } = await supabase
    .from("poptavky")
    .update({
      stav: "objednavka_odeslana",
      objednavka_odeslana_at: now,
      objednavka_odeslana_user_id: preparedByUserId,
    })
    .eq("poptavka_id", poptavkaId)
    .select("poptavka_id")
    .maybeSingle();

  if (poptavkaUpdateError || !updatedPoptavka) {
    return {
      ok: false,
      error: "poptavka_update_failed",
      message: poptavkaUpdateError?.message ?? "poptavka_not_updated",
    };
  }

  const relativeUrl = buildPoptavkaObjednavkaRelativeUrl(rawToken);
  const publicUrl = options.baseUrl?.trim()
    ? buildPoptavkaObjednavkaUrl(options.baseUrl, rawToken)
    : null;

  return {
    ok: true,
    link: mapLinkRow(inserted as Record<string, unknown>),
    rawToken,
    relativeUrl,
    publicUrl,
    snapshot,
  };
}

function isLinkExpired(link: {
  expires_at: string | null;
  potvrzeno_at: string | null;
  odmitnuto_at: string | null;
}): boolean {
  if (link.potvrzeno_at || link.odmitnuto_at) {
    return false;
  }

  if (!link.expires_at) {
    return false;
  }

  return new Date(link.expires_at).getTime() <= Date.now();
}

/**
 * Načte odeslaný link podle raw tokenu (pro budoucí veřejnou stránku).
 * Používá service-role klienta — RLS nepovoluje anonymní čtení linků.
 */
export async function loadPoptavkaObjednavkaLinkByToken(
  rawToken: string
): Promise<LoadPoptavkaObjednavkaLinkByTokenResult> {
  const trimmed = rawToken?.trim();
  if (!trimmed) {
    return { ok: false, error: "invalid_token" };
  }

  const supabase = createAdminClient();
  const tokenHash = hashClientApprovalToken(trimmed);

  const { data: linkRaw, error: linkError } = await supabase
    .from("poptavka_objednavka_links")
    .select(`${LINK_ROW_SELECT}, poptavka:poptavky(poptavka_id, cislo_poptavky, stav, klient_id, misto_nazev)`)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError || !linkRaw) {
    return { ok: false, error: "invalid_token" };
  }

  const link = mapLinkRow(linkRaw as Record<string, unknown>);

  if (link.revoked_at || link.stav === "revoked") {
    return { ok: false, error: "revoked" };
  }

  if (isLinkExpired(link)) {
    return { ok: false, error: "expired" };
  }

  const poptavkaRaw = (linkRaw as { poptavka?: unknown }).poptavka;
  const poptavkaRow = Array.isArray(poptavkaRaw) ? poptavkaRaw[0] : poptavkaRaw;
  if (!poptavkaRow || typeof poptavkaRow !== "object") {
    return { ok: false, error: "invalid_token" };
  }

  const poptavkaStav = (poptavkaRow as { stav: string }).stav;
  if (!isTokenViewPoptavkaStav(poptavkaStav)) {
    return { ok: false, error: "poptavka_state_invalid" };
  }

  const snapshot = parseSnapshot(linkRaw.objednavka_snapshot);
  if (!snapshot) {
    return { ok: false, error: "snapshot_invalid" };
  }

  const poptavka = poptavkaRow as {
    poptavka_id: string;
    cislo_poptavky: string;
    stav: PoptavkaStav;
    klient_id: string | null;
    misto_nazev: string | null;
  };

  return {
    ok: true,
    link: { ...link, objednavka_snapshot: snapshot },
    snapshot,
    poptavka: {
      poptavka_id: poptavka.poptavka_id,
      cislo_poptavky: poptavka.cislo_poptavky,
      stav: poptavka.stav,
      klient_id: poptavka.klient_id,
      misto_nazev: poptavka.misto_nazev,
    },
  };
}

/** První / opakované otevření veřejného odkazu — inkrementuje open_count. */
export async function markPoptavkaObjednavkaLinkOpened(
  linkId: string
): Promise<MarkPoptavkaObjednavkaLinkOpenedResult> {
  const supabase = createAdminClient();

  const { data: existing, error: loadError } = await supabase
    .from("poptavka_objednavka_links")
    .select("link_id, opened_at, open_count")
    .eq("link_id", linkId)
    .maybeSingle();

  if (loadError) {
    return { ok: false, error: "update_failed", message: loadError.message };
  }

  if (!existing) {
    return { ok: false, error: "not_found" };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("poptavka_objednavka_links")
    .update({
      opened_at: existing.opened_at ?? now,
      last_opened_at: now,
      open_count: (existing.open_count ?? 0) + 1,
    })
    .eq("link_id", linkId);

  if (updateError) {
    return { ok: false, error: "update_failed", message: updateError.message };
  }

  return { ok: true };
}

/** Poslední nezrušený odkaz závazné objednávky pro poptávku (interní přehled). */
export async function loadActivePoptavkaObjednavkaLink(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<PoptavkaObjednavkaLinkRow | null> {
  const { data, error } = await supabase
    .from("poptavka_objednavka_links")
    .select(LINK_ROW_SELECT)
    .eq("poptavka_id", poptavkaId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapLinkRow(data as Record<string, unknown>);
}
