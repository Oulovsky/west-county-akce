import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ConvertSetupRow = {
  setupId: string;
  mnozstvi: number | string;
};

export type TechnikaPayloadItem = {
  skladova_polozka_id: string;
  mnozstvi: number;
};

export type BuildTechnikaPayloadResult =
  | { ok: true; payload: TechnikaPayloadItem[] }
  | { ok: false; error: "setup_empty" | "setup_not_found"; message?: string };

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export async function buildTechnikaPayloadFromSetupRows(
  supabase: SupabaseClient,
  setupRows: ConvertSetupRow[]
): Promise<BuildTechnikaPayloadResult> {
  const activeRows = setupRows
    .map((row) => ({
      setupId: row.setupId.trim(),
      mnozstvi: toNumber(row.mnozstvi),
    }))
    .filter((row) => row.setupId && row.mnozstvi > 0);

  if (activeRows.length === 0) {
    return { ok: false, error: "setup_empty" };
  }

  const setupIds = [...new Set(activeRows.map((row) => row.setupId))];

  const { data: existingSetups, error: setupError } = await supabase
    .from("setupy")
    .select("setup_id")
    .in("setup_id", setupIds);

  if (setupError) {
    throw new Error(setupError.message);
  }

  const existingIds = new Set((existingSetups ?? []).map((row) => row.setup_id as string));
  const missingId = setupIds.find((id) => !existingIds.has(id));
  if (missingId) {
    return {
      ok: false,
      error: "setup_not_found",
      message: `Setup ${missingId} neexistuje v katalogu.`,
    };
  }

  const { data: polozkyRaw, error: polozkyError } = await supabase
    .from("setup_polozky")
    .select("setup_id, skladova_polozka_id, mnozstvi")
    .in("setup_id", setupIds);

  if (polozkyError) {
    throw new Error(polozkyError.message);
  }

  const aggregated = new Map<string, number>();

  for (const setupRow of activeRows) {
    for (const polozka of polozkyRaw ?? []) {
      if (polozka.setup_id !== setupRow.setupId) continue;

      const itemQuantity = toNumber(polozka.mnozstvi);
      if (itemQuantity <= 0) continue;

      const total = itemQuantity * setupRow.mnozstvi;
      aggregated.set(
        polozka.skladova_polozka_id as string,
        (aggregated.get(polozka.skladova_polozka_id as string) ?? 0) + total
      );
    }
  }

  return {
    ok: true,
    payload: [...aggregated.entries()].map(([skladova_polozka_id, mnozstvi]) => ({
      skladova_polozka_id,
      mnozstvi: Math.max(1, Math.round(mnozstvi)),
    })),
  };
}
