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
import { prepareObjednavkaDraftForSave } from "@/lib/client-portal/poptavka-objednavka-pricing-server";
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
import { SEND_BINDING_ORDER_POPTAVKA_STAVY } from "@/lib/client-portal/types";
import { canSendPoptavkaBindingOrder } from "@/lib/client-portal/poptavka-internal-server";
import {
  notifyInternalTeamAboutPoptavkaObjednavkaConfirmed,
  notifyInternalTeamAboutPoptavkaObjednavkaRejected,
} from "@/lib/client-portal/poptavka-notifications-server";
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
  odmitnuto_duvod: string | null;
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
        | "invalid_state"
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

export type PoptavkaObjednavkaPublicViewState =
  | "pending"
  | "already_confirmed"
  | "already_rejected";

export type PoptavkaObjednavkaDecisionClientResult =
  | {
      ok: true;
      status: "confirmed" | "already_confirmed" | "rejected" | "already_rejected";
      poptavkaId: string;
      reason?: string | null;
    }
  | { ok: false; errorMessage: string };

export type PoptavkaObjednavkaConfirmAcknowledgements = {
  readOrder: boolean;
  agreeTerms: boolean;
  truthfulness: boolean;
  acknowledgeExtraCosts: boolean;
};

export type PoptavkaObjednavkaDecisionRequestMeta = {
  ip?: string | null;
  userAgent?: string | null;
  acknowledgements?: PoptavkaObjednavkaConfirmAcknowledgements;
};

const DEFAULT_EXPIRES_IN_DAYS = 30;

const LINK_ROW_SELECT =
  "link_id, poptavka_id, klient_id, draft_id, token_hash, email_to, stav, objednavka_snapshot, objednavka_snapshot_created_at, snapshot_schema_version, created_at, expires_at, revoked_at, email_sent_at, opened_at, last_opened_at, open_count, potvrzeno_at, odmitnuto_at, odmitnuto_duvod" as const;

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

/** Počet dříve vytvořených verzí (linků) závazné objednávky pro poptávku. */
export async function countPoptavkaObjednavkaLinkVersions(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("poptavka_objednavka_links")
    .select("link_id", { count: "exact", head: true })
    .eq("poptavka_id", poptavkaId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

function parseSnapshot(raw: unknown): PoptavkaObjednavkaSnapshot | null {
  const validated = validatePoptavkaObjednavkaSnapshot(raw);
  return validated.ok ? validated.snapshot : null;
}

export type ValidatePoptavkaObjednavkaSnapshotResult =
  | { ok: true; snapshot: PoptavkaObjednavkaSnapshot }
  | { ok: false; error: "invalid_confirmed_snapshot" | "snapshot_poptavka_mismatch" };

export function validatePoptavkaObjednavkaSnapshot(
  raw: unknown,
  expectedPoptavkaId?: string
): ValidatePoptavkaObjednavkaSnapshotResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "invalid_confirmed_snapshot" };
  }

  const snapshot = raw as Partial<PoptavkaObjednavkaSnapshot>;
  if (snapshot.version !== POPTAVKA_OBJEDNAVKA_SNAPSHOT_VERSION) {
    return { ok: false, error: "invalid_confirmed_snapshot" };
  }

  if (!snapshot.meta?.poptavkaId || !snapshot.meta?.cisloPoptavky || !snapshot.meta?.linkId) {
    return { ok: false, error: "invalid_confirmed_snapshot" };
  }

  if (expectedPoptavkaId && snapshot.meta.poptavkaId !== expectedPoptavkaId) {
    return { ok: false, error: "snapshot_poptavka_mismatch" };
  }

  return { ok: true, snapshot: snapshot as PoptavkaObjednavkaSnapshot };
}

export type LoadConfirmedPoptavkaObjednavkaLinkResult =
  | { ok: true; link: PoptavkaObjednavkaLinkRow; snapshot: PoptavkaObjednavkaSnapshot }
  | {
      ok: false;
      error: "not_found" | "invalid_confirmed_snapshot" | "snapshot_poptavka_mismatch";
    };

/** Potvrzený odkaz závazné objednávky pro převod na zakázku (ne pending / odmítnutý). */
export async function loadConfirmedPoptavkaObjednavkaLink(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<LoadConfirmedPoptavkaObjednavkaLinkResult> {
  const { data, error } = await supabase
    .from("poptavka_objednavka_links")
    .select(LINK_ROW_SELECT)
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

  if (!data) {
    return { ok: false, error: "not_found" };
  }

  const validated = validatePoptavkaObjednavkaSnapshot(
    (data as Record<string, unknown>).objednavka_snapshot,
    poptavkaId
  );

  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const link = mapLinkRow(data as Record<string, unknown>);

  return {
    ok: true,
    link: { ...link, objednavka_snapshot: validated.snapshot },
    snapshot: validated.snapshot,
  };
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
    odmitnuto_duvod: (row.odmitnuto_duvod as string | null | undefined) ?? null,
  };
}

export function isPoptavkaObjednavkaLinkConfirmed(link: PoptavkaObjednavkaLinkRow) {
  return Boolean(link.potvrzeno_at || link.stav === "potvrzeno");
}

export function isPoptavkaObjednavkaLinkRejected(link: PoptavkaObjednavkaLinkRow) {
  return Boolean(link.odmitnuto_at || link.stav === "odmitnuto");
}

export function getPoptavkaObjednavkaPublicViewState(
  link: PoptavkaObjednavkaLinkRow,
  poptavkaStav: PoptavkaStav
): PoptavkaObjednavkaPublicViewState {
  if (isPoptavkaObjednavkaLinkConfirmed(link) || poptavkaStav === "objednavka_potvrzena") {
    return "already_confirmed";
  }

  if (isPoptavkaObjednavkaLinkRejected(link) || poptavkaStav === "objednavka_odmitnuta") {
    return "already_rejected";
  }

  return "pending";
}

export function canDecideOnPoptavkaObjednavkaLink(
  link: PoptavkaObjednavkaLinkRow,
  poptavkaStav: PoptavkaStav
) {
  if (link.revoked_at || link.stav === "revoked") {
    return false;
  }

  if (isLinkExpired(link)) {
    return false;
  }

  if (getPoptavkaObjednavkaPublicViewState(link, poptavkaStav) !== "pending") {
    return false;
  }

  return poptavkaStav === "objednavka_odeslana";
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

  const poptavkaStav = poptavka.stav as PoptavkaStav;
  if (!canSendPoptavkaBindingOrder(poptavkaStav)) {
    return { ok: false, error: "invalid_state" };
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
  const preparedDraft = await prepareObjednavkaDraftForSave(supabase, normalizedDraft, {
    freezeBreakdown: true,
  });
  const preparedByUserId = await resolvePreparedByUserId(supabase, options.preparedByUserId);
  const emailTo = await resolveEmailTo(
    supabase,
    poptavka,
    preparedDraft.klient.email,
    options.emailTo
  );

  const now = new Date().toISOString();
  const linkId = randomUUID();
  const rawToken = createClientApprovalToken();
  const tokenHash = hashClientApprovalToken(rawToken);
  const expiresAt = addDaysIso(expiresInDays);

  const fotkaSignedSeconds = Math.max(expiresInDays, 1) * 24 * 60 * 60;
  const fotkaPublicUrls = await resolveDraftFotkaSignedUrls(
    preparedDraft.fotky,
    fotkaSignedSeconds
  );

  const previousVersionCount = await countPoptavkaObjednavkaLinkVersions(supabase, poptavkaId);
  const navrhVerze = previousVersionCount + 1;

  const snapshot = draftToPoptavkaObjednavkaSnapshot({
    draft: preparedDraft,
    draftId: draftRow.draft_id,
    linkId,
    meta: {
      poptavkaId,
      cisloPoptavky: poptavka.cislo_poptavky,
      navrhVerze,
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
    .in("stav", [...SEND_BINDING_ORDER_POPTAVKA_STAVY])
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

type DecisionLinkContext = {
  link: PoptavkaObjednavkaLinkRow;
  poptavka: PoptavkaObjednavkaLinkPoptavkaSummary;
};

type ConfirmPoptavkaObjednavkaZpusob = "token" | "portal";

type PortalDecisionLoadError =
  | "not_found"
  | "forbidden"
  | "revoked"
  | "expired"
  | "snapshot_invalid"
  | "state_invalid";

export type PortalPoptavkaObjednavkaDecisionView = {
  canDecide: boolean;
  viewState: PoptavkaObjednavkaPublicViewState;
  snapshot: PoptavkaObjednavkaSnapshot;
  rejectReason: string | null;
  expiresAt: string | null;
  cisloPoptavky: string;
};

function decisionErrorMessage(
  code:
    | "invalid_token"
    | "revoked"
    | "expired"
    | "snapshot_invalid"
    | "already_confirmed"
    | "already_rejected"
    | "state_invalid"
    | "save_failed"
): string {
  switch (code) {
    case "revoked":
      return "Tato verze objednávky byla nahrazena novější verzí. Požádejte organizátora akce o aktuální odkaz.";
    case "expired":
      return "Platnost odkazu vypršela. Požádejte organizátora akce o nový odkaz.";
    case "already_confirmed":
      return "Objednávka už byla potvrzena.";
    case "already_rejected":
      return "Objednávka už byla odmítnuta.";
    case "state_invalid":
      return "Objednávku už nelze tímto odkazem zpracovat.";
    case "save_failed":
      return "Uložení rozhodnutí se nezdařilo. Zkuste to prosím znovu.";
    case "snapshot_invalid":
    case "invalid_token":
    default:
      return "Odkaz není platný.";
  }
}

function portalDecisionErrorMessage(error: PortalDecisionLoadError): string {
  switch (error) {
    case "forbidden":
      return "Nemáte oprávnění k této poptávce.";
    case "not_found":
      return "Závazná objednávka pro tuto poptávku nebyla nalezena.";
    case "revoked":
      return decisionErrorMessage("revoked");
    case "expired":
      return decisionErrorMessage("expired");
    case "snapshot_invalid":
      return "Obsah objednávky není k dispozici. Kontaktujte prosím WEST COUNTY.";
    case "state_invalid":
      return decisionErrorMessage("state_invalid");
    default:
      return "Objednávku nelze zpracovat.";
  }
}

function mapDecisionLinkContextFromJoinedRow(
  linkRaw: Record<string, unknown>
): DecisionLinkContext | null {
  const link = mapLinkRow(linkRaw);
  const poptavkaRaw = linkRaw.poptavka;
  const poptavkaRow = Array.isArray(poptavkaRaw) ? poptavkaRaw[0] : poptavkaRaw;
  if (!poptavkaRow || typeof poptavkaRow !== "object") {
    return null;
  }

  const snapshot = parseSnapshot(linkRaw.objednavka_snapshot);
  if (!snapshot) {
    return null;
  }

  const poptavka = poptavkaRow as PoptavkaObjednavkaLinkPoptavkaSummary;

  return {
    link: { ...link, objednavka_snapshot: snapshot },
    poptavka,
  };
}


async function loadPortalDecisionLinkContext(
  poptavkaId: string,
  klientId: string
): Promise<
  | { ok: true; context: DecisionLinkContext }
  | { ok: false; error: PortalDecisionLoadError }
> {
  const supabase = createAdminClient();

  const { data: poptavkaRaw, error: poptavkaError } = await supabase
    .from("poptavky")
    .select("poptavka_id, cislo_poptavky, stav, klient_id, misto_nazev")
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (poptavkaError || !poptavkaRaw) {
    return { ok: false, error: "not_found" };
  }

  if (!poptavkaRaw.klient_id || poptavkaRaw.klient_id !== klientId) {
    return { ok: false, error: "forbidden" };
  }

  const { data: linkRaw, error: linkError } = await supabase
    .from("poptavka_objednavka_links")
    .select(LINK_ROW_SELECT)
    .eq("poptavka_id", poptavkaId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkError || !linkRaw) {
    return { ok: false, error: "not_found" };
  }

  const link = mapLinkRow(linkRaw as Record<string, unknown>);

  if (link.revoked_at || link.stav === "revoked") {
    return { ok: false, error: "revoked" };
  }

  if (isLinkExpired(link)) {
    return { ok: false, error: "expired" };
  }

  const snapshot = parseSnapshot(linkRaw.objednavka_snapshot);
  if (!snapshot) {
    return { ok: false, error: "snapshot_invalid" };
  }

  const poptavka = poptavkaRaw as PoptavkaObjednavkaLinkPoptavkaSummary;

  return {
    ok: true,
    context: {
      link: { ...link, objednavka_snapshot: snapshot },
      poptavka,
    },
  };
}

export async function loadPortalPoptavkaObjednavkaDecisionView(
  poptavkaId: string,
  klientId: string,
  poptavkaStav: PoptavkaStav
): Promise<PortalPoptavkaObjednavkaDecisionView | null> {
  if (
    poptavkaStav !== "objednavka_odeslana" &&
    poptavkaStav !== "objednavka_potvrzena" &&
    poptavkaStav !== "objednavka_odmitnuta"
  ) {
    return null;
  }

  const loaded = await loadPortalDecisionLinkContext(poptavkaId, klientId);
  if (!loaded.ok) {
    return null;
  }

  const { link, poptavka } = loaded.context;

  return {
    canDecide: canDecideOnPoptavkaObjednavkaLink(link, poptavka.stav),
    viewState: getPoptavkaObjednavkaPublicViewState(link, poptavka.stav),
    snapshot: link.objednavka_snapshot,
    rejectReason: link.odmitnuto_duvod,
    expiresAt: link.expires_at,
    cisloPoptavky: poptavka.cislo_poptavky,
  };
}

async function loadDecisionLinkContext(
  rawToken: string
): Promise<
  | { ok: true; context: DecisionLinkContext }
  | { ok: false; error: "invalid_token" | "revoked" | "expired" | "snapshot_invalid" }
> {
  const trimmed = rawToken?.trim();
  if (!trimmed) {
    return { ok: false, error: "invalid_token" };
  }

  const supabase = createAdminClient();
  const tokenHash = hashClientApprovalToken(trimmed);

  const { data: linkRaw, error: linkError } = await supabase
    .from("poptavka_objednavka_links")
    .select(
      `${LINK_ROW_SELECT}, poptavka:poptavky(poptavka_id, cislo_poptavky, stav, klient_id, misto_nazev)`
    )
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

  const context = mapDecisionLinkContextFromJoinedRow(linkRaw as Record<string, unknown>);
  if (!context) {
    return { ok: false, error: "snapshot_invalid" };
  }

  return { ok: true, context };
}

async function confirmPoptavkaObjednavkaByContext(
  context: DecisionLinkContext,
  meta: PoptavkaObjednavkaDecisionRequestMeta,
  zpusob: ConfirmPoptavkaObjednavkaZpusob,
  reloadContext: () => Promise<DecisionLinkContext | null>
): Promise<PoptavkaObjednavkaDecisionClientResult> {
  const { link, poptavka } = context;

  if (isPoptavkaObjednavkaLinkConfirmed(link)) {
    return {
      ok: true,
      status: "already_confirmed",
      poptavkaId: poptavka.poptavka_id,
    };
  }

  if (isPoptavkaObjednavkaLinkRejected(link)) {
    return { ok: false, errorMessage: decisionErrorMessage("already_rejected") };
  }

  if (poptavka.stav !== "objednavka_odeslana") {
    if (poptavka.stav === "objednavka_potvrzena") {
      return {
        ok: true,
        status: "already_confirmed",
        poptavkaId: poptavka.poptavka_id,
      };
    }

    return { ok: false, errorMessage: decisionErrorMessage("state_invalid") };
  }

  const ack = meta.acknowledgements;
  if (
    !ack?.readOrder ||
    !ack?.agreeTerms ||
    !ack?.truthfulness ||
    !ack?.acknowledgeExtraCosts
  ) {
    return {
      ok: false,
      errorMessage:
        "Pro potvrzení objednávky je nutné zaškrtnout všechna potvrzení níže.",
    };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: updatedLink, error: linkError } = await supabase
    .from("poptavka_objednavka_links")
    .update({
      stav: "potvrzeno",
      potvrzeno_at: now,
      potvrzeno_ip: meta.ip ?? null,
      potvrzeno_user_agent: meta.userAgent ?? null,
    })
    .eq("link_id", link.link_id)
    .is("potvrzeno_at", null)
    .is("odmitnuto_at", null)
    .is("revoked_at", null)
    .select("link_id")
    .maybeSingle();

  if (linkError) {
    return { ok: false, errorMessage: decisionErrorMessage("save_failed") };
  }

  if (!updatedLink) {
    const reload = await reloadContext();
    if (reload && isPoptavkaObjednavkaLinkConfirmed(reload.link)) {
      return {
        ok: true,
        status: "already_confirmed",
        poptavkaId: reload.poptavka.poptavka_id,
      };
    }

    return { ok: false, errorMessage: decisionErrorMessage("save_failed") };
  }

  const { data: updatedPoptavka, error: poptavkaError } = await supabase
    .from("poptavky")
    .update({
      stav: "objednavka_potvrzena",
      objednavka_potvrzena_at: now,
      objednavka_potvrzena_zpusob: zpusob,
      updated_at: now,
    })
    .eq("poptavka_id", poptavka.poptavka_id)
    .eq("stav", "objednavka_odeslana")
    .select("poptavka_id")
    .maybeSingle();

  if (poptavkaError || !updatedPoptavka) {
    const reload = await reloadContext();
    if (reload && reload.poptavka.stav === "objednavka_potvrzena") {
      return {
        ok: true,
        status: "already_confirmed",
        poptavkaId: reload.poptavka.poptavka_id,
      };
    }

    return { ok: false, errorMessage: decisionErrorMessage("save_failed") };
  }

  try {
    await notifyInternalTeamAboutPoptavkaObjednavkaConfirmed({
      poptavkaId: poptavka.poptavka_id,
      cisloPoptavky: poptavka.cislo_poptavky,
      mistoNazev: poptavka.misto_nazev,
    });
  } catch (notifyError) {
    console.warn("Poptavka objednavka confirmed notification failed:", notifyError);
  }

  return {
    ok: true,
    status: "confirmed",
    poptavkaId: poptavka.poptavka_id,
  };
}

async function rejectPoptavkaObjednavkaByContext(
  context: DecisionLinkContext,
  reason: string | null | undefined,
  reloadContext: () => Promise<DecisionLinkContext | null>
): Promise<PoptavkaObjednavkaDecisionClientResult> {
  const { link, poptavka } = context;
  const trimmedReason = reason?.trim() || null;

  if (!trimmedReason) {
    return {
      ok: false,
      errorMessage: "Pro odmítnutí objednávky je nutné uvést důvod.",
    };
  }

  if (isPoptavkaObjednavkaLinkRejected(link)) {
    return {
      ok: true,
      status: "already_rejected",
      poptavkaId: poptavka.poptavka_id,
      reason: link.odmitnuto_duvod ?? trimmedReason,
    };
  }

  if (isPoptavkaObjednavkaLinkConfirmed(link)) {
    return { ok: false, errorMessage: decisionErrorMessage("already_confirmed") };
  }

  if (poptavka.stav !== "objednavka_odeslana") {
    if (poptavka.stav === "objednavka_odmitnuta") {
      return {
        ok: true,
        status: "already_rejected",
        poptavkaId: poptavka.poptavka_id,
        reason: trimmedReason,
      };
    }

    return { ok: false, errorMessage: decisionErrorMessage("state_invalid") };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: updatedLink, error: linkError } = await supabase
    .from("poptavka_objednavka_links")
    .update({
      stav: "odmitnuto",
      odmitnuto_at: now,
      odmitnuto_duvod: trimmedReason,
    })
    .eq("link_id", link.link_id)
    .is("potvrzeno_at", null)
    .is("odmitnuto_at", null)
    .is("revoked_at", null)
    .select("link_id")
    .maybeSingle();

  if (linkError) {
    return { ok: false, errorMessage: decisionErrorMessage("save_failed") };
  }

  if (!updatedLink) {
    const reload = await reloadContext();
    if (reload && isPoptavkaObjednavkaLinkRejected(reload.link)) {
      return {
        ok: true,
        status: "already_rejected",
        poptavkaId: reload.poptavka.poptavka_id,
        reason: reload.link.odmitnuto_duvod ?? trimmedReason,
      };
    }

    return { ok: false, errorMessage: decisionErrorMessage("save_failed") };
  }

  const { data: updatedPoptavka, error: poptavkaError } = await supabase
    .from("poptavky")
    .update({
      stav: "objednavka_odmitnuta",
      objednavka_odmitnuta_at: now,
      objednavka_odmitnuta_duvod: trimmedReason,
      updated_at: now,
    })
    .eq("poptavka_id", poptavka.poptavka_id)
    .eq("stav", "objednavka_odeslana")
    .select("poptavka_id")
    .maybeSingle();

  if (poptavkaError || !updatedPoptavka) {
    const reload = await reloadContext();
    if (reload && reload.poptavka.stav === "objednavka_odmitnuta") {
      return {
        ok: true,
        status: "already_rejected",
        poptavkaId: reload.poptavka.poptavka_id,
        reason: reload.link.odmitnuto_duvod ?? trimmedReason,
      };
    }

    return { ok: false, errorMessage: decisionErrorMessage("save_failed") };
  }

  try {
    await notifyInternalTeamAboutPoptavkaObjednavkaRejected({
      poptavkaId: poptavka.poptavka_id,
      cisloPoptavky: poptavka.cislo_poptavky,
      mistoNazev: poptavka.misto_nazev,
      reason: trimmedReason,
    });
  } catch (notifyError) {
    console.warn("Poptavka objednavka rejected notification failed:", notifyError);
  }

  return {
    ok: true,
    status: "rejected",
    poptavkaId: poptavka.poptavka_id,
    reason: trimmedReason,
  };
}

export async function confirmPoptavkaObjednavkaFromPortal(
  poptavkaId: string,
  klientId: string,
  meta: PoptavkaObjednavkaDecisionRequestMeta = {}
): Promise<PoptavkaObjednavkaDecisionClientResult> {
  const loaded = await loadPortalDecisionLinkContext(poptavkaId, klientId);
  if (!loaded.ok) {
    return { ok: false, errorMessage: portalDecisionErrorMessage(loaded.error) };
  }

  return confirmPoptavkaObjednavkaByContext(
    loaded.context,
    meta,
    "portal",
    async () => {
      const reload = await loadPortalDecisionLinkContext(poptavkaId, klientId);
      return reload.ok ? reload.context : null;
    }
  );
}

export async function rejectPoptavkaObjednavkaFromPortal(
  poptavkaId: string,
  klientId: string,
  reason: string | null | undefined,
  meta: PoptavkaObjednavkaDecisionRequestMeta = {}
): Promise<PoptavkaObjednavkaDecisionClientResult> {
  void meta;
  const loaded = await loadPortalDecisionLinkContext(poptavkaId, klientId);
  if (!loaded.ok) {
    return { ok: false, errorMessage: portalDecisionErrorMessage(loaded.error) };
  }

  return rejectPoptavkaObjednavkaByContext(loaded.context, reason, async () => {
    const reload = await loadPortalDecisionLinkContext(poptavkaId, klientId);
    return reload.ok ? reload.context : null;
  });
}

export async function confirmPoptavkaObjednavkaByToken(
  rawToken: string,
  meta: PoptavkaObjednavkaDecisionRequestMeta = {}
): Promise<PoptavkaObjednavkaDecisionClientResult> {
  const loaded = await loadDecisionLinkContext(rawToken);
  if (!loaded.ok) {
    return { ok: false, errorMessage: decisionErrorMessage(loaded.error) };
  }

  return confirmPoptavkaObjednavkaByContext(loaded.context, meta, "token", async () => {
    const reload = await loadDecisionLinkContext(rawToken);
    return reload.ok ? reload.context : null;
  });
}

export async function rejectPoptavkaObjednavkaByToken(
  rawToken: string,
  reason: string | null | undefined,
  meta: PoptavkaObjednavkaDecisionRequestMeta = {}
): Promise<PoptavkaObjednavkaDecisionClientResult> {
  void meta;
  const loaded = await loadDecisionLinkContext(rawToken);
  if (!loaded.ok) {
    return { ok: false, errorMessage: decisionErrorMessage(loaded.error) };
  }

  return rejectPoptavkaObjednavkaByContext(loaded.context, reason, async () => {
    const reload = await loadDecisionLinkContext(rawToken);
    return reload.ok ? reload.context : null;
  });
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
