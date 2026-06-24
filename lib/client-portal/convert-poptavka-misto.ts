import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";

export type MistoConvertHints = {
  nazev: string | null;
  adresa: string | null;
  lat: number | null;
  lng: number | null;
  poznamka?: string | null;
};

export type ResolveMistoForPoptavkaConvertResult =
  | {
      ok: true;
      mistoId: string | null;
      created: boolean;
      poptavkaMistoIdUpdated: boolean;
    }
  | {
      ok: false;
      error: "misto_resolve_failed";
      message?: string;
    };

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function hasCreateableMistoData(hints: MistoConvertHints) {
  return Boolean(
    hints.nazev?.trim() ||
      hints.adresa?.trim() ||
      (hints.lat != null && hints.lng != null && Number.isFinite(hints.lat) && Number.isFinite(hints.lng))
  );
}

async function assignKlientIdToMistoIfNull(
  supabase: SupabaseClient,
  mistoId: string,
  klientId: string
) {
  const { error } = await supabase
    .from("mista_konani")
    .update({
      klient_id: klientId,
      updated_at: new Date().toISOString(),
    })
    .eq("misto_id", mistoId)
    .is("klient_id", null);

  if (error) {
    throw new Error(error.message);
  }
}

async function verifyPoptavkaMistoId(
  supabase: SupabaseClient,
  mistoId: string,
  klientId: string,
  options: { assignKlientIfNull: boolean }
): Promise<string | null> {
  const { data, error } = await supabase
    .from("mista_konani")
    .select("misto_id, klient_id")
    .eq("misto_id", mistoId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.misto_id) {
    return null;
  }

  const mistoKlientId = data.klient_id as string | null;

  if (mistoKlientId && mistoKlientId !== klientId) {
    return null;
  }

  if (!mistoKlientId) {
    if (!options.assignKlientIfNull) {
      return null;
    }
    await assignKlientIdToMistoIfNull(supabase, mistoId, klientId);
  }

  return data.misto_id as string;
}

async function findUniqueMistoByHint(
  supabase: SupabaseClient,
  klientId: string,
  field: "nazev" | "adresa_text",
  value: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("mista_konani")
    .select("misto_id")
    .eq("klient_id", klientId)
    .ilike(field, value);

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length !== 1) {
    return null;
  }

  return data[0].misto_id as string;
}

async function patchEmptyMistoFields(
  supabase: SupabaseClient,
  mistoId: string,
  hints: MistoConvertHints
) {
  const { data: row, error } = await supabase
    .from("mista_konani")
    .select("nazev, adresa_text, lat, lng, poznamka")
    .eq("misto_id", mistoId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!row) {
    return;
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (!nullableText(row.nazev as string | null) && hints.nazev) {
    patch.nazev = hints.nazev;
  }
  if (!nullableText(row.adresa_text as string | null) && hints.adresa) {
    patch.adresa_text = hints.adresa;
  }
  if (row.lat == null && hints.lat != null) {
    patch.lat = hints.lat;
  }
  if (row.lng == null && hints.lng != null) {
    patch.lng = hints.lng;
  }
  if (!nullableText(row.poznamka as string | null) && hints.poznamka) {
    patch.poznamka = hints.poznamka;
  }

  if (Object.keys(patch).length <= 1) {
    return;
  }

  const { error: updateError } = await supabase
    .from("mista_konani")
    .update(patch)
    .eq("misto_id", mistoId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function createMistoKonani(
  supabase: SupabaseClient,
  klientId: string,
  hints: MistoConvertHints
): Promise<string> {
  const nazev =
    hints.nazev?.trim() ||
    hints.adresa?.trim() ||
    (hints.lat != null && hints.lng != null ? "Místo akce" : null);

  if (!nazev) {
    throw new Error("Chybí název nebo adresa pro vytvoření místa.");
  }

  const { data, error } = await supabase
    .from("mista_konani")
    .insert({
      klient_id: klientId,
      nazev,
      adresa_text: hints.adresa?.trim() || null,
      lat: hints.lat,
      lng: hints.lng,
      radius_m: hints.lat != null && hints.lng != null ? 300 : null,
      poznamka: hints.poznamka?.trim() || null,
      aktivni: true,
    })
    .select("misto_id")
    .single();

  if (error || !data?.misto_id) {
    throw new Error(error?.message ?? "Vytvoření místa selhalo.");
  }

  return data.misto_id as string;
}

async function syncPoptavkaMistoId(
  supabase: SupabaseClient,
  poptavkaId: string,
  expectedCurrentMistoId: string | null,
  resolvedMistoId: string
) {
  let query = supabase
    .from("poptavky")
    .update({
      misto_id: resolvedMistoId,
      updated_at: new Date().toISOString(),
    })
    .eq("poptavka_id", poptavkaId);

  if (expectedCurrentMistoId === null) {
    query = query.is("misto_id", null);
  } else {
    query = query.eq("misto_id", expectedCurrentMistoId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

export async function resolveMistoForPoptavkaConvert(
  supabase: SupabaseClient,
  detail: InternalPoptavkaDetail,
  hints: MistoConvertHints
): Promise<ResolveMistoForPoptavkaConvertResult> {
  try {
    if (!detail.klient_id) {
      return { ok: true, mistoId: null, created: false, poptavkaMistoIdUpdated: false };
    }

    let mistoId: string | null = null;
    let created = false;
    let verifiedOriginalMistoId: string | null = null;

    if (detail.misto_id) {
      verifiedOriginalMistoId = await verifyPoptavkaMistoId(
        supabase,
        detail.misto_id,
        detail.klient_id,
        { assignKlientIfNull: true }
      );
      mistoId = verifiedOriginalMistoId;
    }

    if (!mistoId && hints.nazev) {
      mistoId = await findUniqueMistoByHint(supabase, detail.klient_id, "nazev", hints.nazev);
    }

    if (!mistoId && hints.adresa) {
      mistoId = await findUniqueMistoByHint(supabase, detail.klient_id, "adresa_text", hints.adresa);
    }

    if (!mistoId && hasCreateableMistoData(hints)) {
      mistoId = await createMistoKonani(supabase, detail.klient_id, hints);
      created = true;
    }

    if (!mistoId) {
      return { ok: true, mistoId: null, created: false, poptavkaMistoIdUpdated: false };
    }

    if (!created) {
      await patchEmptyMistoFields(supabase, mistoId, hints);
    }

    let poptavkaMistoIdUpdated = false;

    if (!detail.misto_id) {
      await syncPoptavkaMistoId(supabase, detail.poptavka_id, null, mistoId);
      poptavkaMistoIdUpdated = true;
    } else if (!verifiedOriginalMistoId && mistoId !== detail.misto_id) {
      await syncPoptavkaMistoId(supabase, detail.poptavka_id, detail.misto_id, mistoId);
      poptavkaMistoIdUpdated = true;
    }

    return { ok: true, mistoId, created, poptavkaMistoIdUpdated };
  } catch (error) {
    return {
      ok: false,
      error: "misto_resolve_failed",
      message: error instanceof Error ? error.message : "resolve_failed",
    };
  }
}
