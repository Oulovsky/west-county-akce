import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoptavkaSetupInput } from "@/lib/client-portal/poptavka-form";
import { createAdminClient } from "@/lib/supabase/admin";

type SetupRow = PoptavkaSetupInput;

function nullableNote(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

/** Sloučí řádky se stejným setup_id — DB má unikátní (poptavka_id, setup_id). */
export function normalizePoptavkaSetupRows(setupy: SetupRow[]): SetupRow[] {
  const map = new Map<string, SetupRow>();

  for (const row of setupy) {
    const setupId = row.setup_id?.trim();
    if (!setupId) continue;

    const mnozstvi = Math.max(1, Math.floor(Number(row.mnozstvi) || 1));
    const poznamka = nullableNote(row.poznamka_klienta);
    const existing = map.get(setupId);

    if (!existing) {
      map.set(setupId, {
        setup_id: setupId,
        mnozstvi,
        poznamka_klienta: poznamka,
      });
      continue;
    }

    existing.mnozstvi += mnozstvi;
    const notes = [existing.poznamka_klienta, poznamka].filter(Boolean);
    existing.poznamka_klienta = notes.length ? notes.join("; ") : null;
  }

  return Array.from(map.values());
}

function setupRowsEqual(a: SetupRow[], b: SetupRow[]) {
  const left = normalizePoptavkaSetupRows(a)
    .map((row) => ({
      setup_id: row.setup_id,
      mnozstvi: row.mnozstvi,
      poznamka_klienta: nullableNote(row.poznamka_klienta),
    }))
    .sort((x, y) => x.setup_id.localeCompare(y.setup_id));

  const right = normalizePoptavkaSetupRows(b)
    .map((row) => ({
      setup_id: row.setup_id,
      mnozstvi: row.mnozstvi,
      poznamka_klienta: nullableNote(row.poznamka_klienta),
    }))
    .sort((x, y) => x.setup_id.localeCompare(y.setup_id));

  if (left.length !== right.length) return false;

  return left.every(
    (row, index) =>
      row.setup_id === right[index]?.setup_id &&
      row.mnozstvi === right[index]?.mnozstvi &&
      row.poznamka_klienta === right[index]?.poznamka_klienta
  );
}

async function countPoptavkaSetups(supabase: SupabaseClient, poptavkaId: string) {
  const { count, error } = await supabase
    .from("poptavka_setupy")
    .select("poptavka_id", { count: "exact", head: true })
    .eq("poptavka_id", poptavkaId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function deleteAllPoptavkaSetups(supabase: SupabaseClient, poptavkaId: string) {
  const { error: deleteError } = await supabase
    .from("poptavka_setupy")
    .delete()
    .eq("poptavka_id", poptavkaId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const remaining = await countPoptavkaSetups(supabase, poptavkaId);
  if (remaining === 0) {
    return;
  }

  console.warn("[poptavka setupy] client delete left rows, retrying with admin", {
    poptavkaId,
    remaining,
  });

  const admin = createAdminClient();
  const { error: adminDeleteError } = await admin
    .from("poptavka_setupy")
    .delete()
    .eq("poptavka_id", poptavkaId);

  if (adminDeleteError) {
    throw new Error(adminDeleteError.message);
  }

  const remainingAfterAdmin = await countPoptavkaSetups(admin, poptavkaId);
  if (remainingAfterAdmin > 0) {
    throw new Error(
      `Nepodařilo se odstranit existující setupy poptávky (${remainingAfterAdmin} záznamů).`
    );
  }
}

export async function loadPoptavkaSetupInputs(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<SetupRow[]> {
  const { data, error } = await supabase
    .from("poptavka_setupy")
    .select("setup_id, mnozstvi, poznamka_klienta")
    .eq("poptavka_id", poptavkaId)
    .order("poradi", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    setup_id: row.setup_id as string,
    mnozstvi: Math.max(1, Math.floor(Number(row.mnozstvi) || 1)),
    poznamka_klienta: nullableNote(row.poznamka_klienta as string | null),
  }));
}

export async function arePoptavkaSetupsUnchanged(
  supabase: SupabaseClient,
  poptavkaId: string,
  setupy: SetupRow[]
) {
  const existing = await loadPoptavkaSetupInputs(supabase, poptavkaId);
  return setupRowsEqual(existing, setupy);
}

export async function replacePoptavkaSetups(
  supabase: SupabaseClient,
  poptavkaId: string,
  setupy: SetupRow[],
  options?: { skipIfUnchanged?: boolean }
) {
  const normalized = normalizePoptavkaSetupRows(setupy);

  if (options?.skipIfUnchanged) {
    const unchanged = await arePoptavkaSetupsUnchanged(supabase, poptavkaId, normalized);
    if (unchanged) {
      return { replaced: false as const, rowCount: normalized.length };
    }
  }

  await deleteAllPoptavkaSetups(supabase, poptavkaId);

  if (normalized.length === 0) {
    return { replaced: true as const, rowCount: 0 };
  }

  const rows = normalized.map((row, index) => ({
    poptavka_id: poptavkaId,
    setup_id: row.setup_id,
    mnozstvi: row.mnozstvi,
    poznamka_klienta: nullableNote(row.poznamka_klienta),
    poradi: index,
  }));

  const { error: insertError } = await supabase.from("poptavka_setupy").insert(rows);

  if (insertError) {
    throw new Error(insertError.message);
  }

  return { replaced: true as const, rowCount: normalized.length };
}
