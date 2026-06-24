import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import type { ClientPortalMistoSummary } from "@/lib/client-portal/client-mista-shared";
import { createAdminClient } from "@/lib/supabase/admin";

export type { ClientPortalMistoSummary } from "@/lib/client-portal/client-mista-shared";

const MISTO_DETAIL_NOTES_LIMIT = 5;

export type ClientPortalMistoTechnickaPoznamka = {
  id: string;
  misto_id: string;
  typ: string;
  text: string;
  dulezite: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientPortalMistoTechnickaFotka = {
  id: string;
  misto_id: string;
  storage_bucket: string;
  storage_path: string;
  typ: string;
  popis: string | null;
  dulezite: boolean;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  signedUrl: string | null;
};

export type ClientPortalMistoDetail = ClientPortalMistoSummary & {
  poznamky: ClientPortalMistoTechnickaPoznamka[];
  fotky: ClientPortalMistoTechnickaFotka[];
};

export type AssertClientMistoIdResult =
  | { ok: true; mistoId: null }
  | { ok: true; mistoId: string }
  | { ok: false; error: "invalid_misto" };

function nullableMistoId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

async function signMistoTechnickaFotkaUrl(
  row: Omit<ClientPortalMistoTechnickaFotka, "signedUrl">
): Promise<ClientPortalMistoTechnickaFotka> {
  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, 60 * 60);

  return {
    ...row,
    signedUrl: signed?.signedUrl ?? null,
  };
}

export async function loadClientMistaKonaniForPortal(
  supabase: SupabaseClient
): Promise<ClientPortalMistoSummary[]> {
  const session = await requireActiveClientPortalSession(supabase);
  const klientId = session.account.klient_id!;

  const { data, error } = await supabase
    .from("mista_konani")
    .select("misto_id, nazev, adresa_text, lat, lng, poznamka, updated_at")
    .eq("klient_id", klientId)
    .eq("aktivni", true)
    .order("nazev", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClientPortalMistoSummary[];
}

export async function assertClientCanUseMistoId(
  supabase: SupabaseClient,
  mistoId: string | null | undefined
): Promise<AssertClientMistoIdResult> {
  const normalizedMistoId = nullableMistoId(mistoId);
  if (!normalizedMistoId) {
    return { ok: true, mistoId: null };
  }

  const session = await requireActiveClientPortalSession(supabase);
  const klientId = session.account.klient_id!;

  const { data, error } = await supabase
    .from("mista_konani")
    .select("misto_id")
    .eq("misto_id", normalizedMistoId)
    .eq("klient_id", klientId)
    .eq("aktivni", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.misto_id) {
    return { ok: false, error: "invalid_misto" };
  }

  return { ok: true, mistoId: data.misto_id as string };
}

export async function loadClientMistoDetailForPortal(
  supabase: SupabaseClient,
  mistoId: string
): Promise<ClientPortalMistoDetail | null> {
  const access = await assertClientCanUseMistoId(supabase, mistoId);
  if (!access.ok) {
    return null;
  }

  const { data: misto, error: mistoError } = await supabase
    .from("mista_konani")
    .select("misto_id, nazev, adresa_text, lat, lng, poznamka, updated_at")
    .eq("misto_id", access.mistoId)
    .maybeSingle();

  if (mistoError) {
    throw new Error(mistoError.message);
  }

  if (!misto?.misto_id) {
    return null;
  }

  const [{ data: poznamkyRaw, error: poznamkyError }, { data: fotkyRaw, error: fotkyError }] =
    await Promise.all([
      supabase
        .from("misto_technicke_poznamky")
        .select("id, misto_id, typ, text, dulezite, created_at, updated_at")
        .eq("misto_id", access.mistoId)
        .order("dulezite", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(MISTO_DETAIL_NOTES_LIMIT),
      supabase
        .from("misto_technicke_fotky")
        .select(
          "id, misto_id, storage_bucket, storage_path, typ, popis, dulezite, original_filename, mime_type, size_bytes, created_at"
        )
        .eq("misto_id", access.mistoId)
        .order("dulezite", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  if (poznamkyError) {
    throw new Error(poznamkyError.message);
  }

  if (fotkyError) {
    throw new Error(fotkyError.message);
  }

  const fotky = await Promise.all(
    ((fotkyRaw ?? []) as Omit<ClientPortalMistoTechnickaFotka, "signedUrl">[]).map((row) =>
      signMistoTechnickaFotkaUrl(row)
    )
  );

  return {
    ...(misto as ClientPortalMistoSummary),
    poznamky: (poznamkyRaw ?? []) as ClientPortalMistoTechnickaPoznamka[],
    fotky,
  };
}
