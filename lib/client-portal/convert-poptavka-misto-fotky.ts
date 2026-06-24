import "server-only";

import type { PoptavkaFotkaTyp } from "@/lib/client-portal/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type PoptavkaFotkaRow = {
  id: string;
  poptavka_id: string;
  storage_bucket: string;
  storage_path: string;
  typ: string;
  popis: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
};

export function mapPoptavkaFotkaTypToMisto(typ: string): string {
  switch (typ as PoptavkaFotkaTyp) {
    case "rozvadec":
      return "rozvadec";
    case "prijezd":
      return "prijezd";
    case "plocha_stage":
      return "stage";
    case "misto_akce":
      return "jina";
    default:
      return "jina";
  }
}

export type PromotePoptavkaFotkyToMistoResult = {
  ok: boolean;
  promoted: number;
  skipped: number;
  failed: number;
  message?: string;
};

export async function promotePoptavkaFotkyToMisto(
  supabase: SupabaseClient,
  params: {
    mistoId: string;
    poptavkaId: string;
    zakazkaId: string;
    snapshotFotkaIds: string[] | null;
  }
): Promise<PromotePoptavkaFotkyToMistoResult> {
  const { data: fotky, error: loadError } = await supabase
    .from("poptavka_fotky")
    .select(
      "id, poptavka_id, storage_bucket, storage_path, typ, popis, original_filename, mime_type, size_bytes"
    )
    .eq("poptavka_id", params.poptavkaId)
    .order("poradi", { ascending: true });

  if (loadError) {
    return {
      ok: false,
      promoted: 0,
      skipped: 0,
      failed: 0,
      message: loadError.message,
    };
  }

  const allFotky = (fotky ?? []) as PoptavkaFotkaRow[];
  const filtered =
    params.snapshotFotkaIds && params.snapshotFotkaIds.length > 0
      ? allFotky.filter((row) => params.snapshotFotkaIds!.includes(row.id))
      : allFotky;

  if (filtered.length === 0) {
    return { ok: true, promoted: 0, skipped: 0, failed: 0 };
  }

  let promoted = 0;
  let skipped = 0;
  let failed = 0;

  for (const fotka of filtered) {
    const { data: existing, error: existingError } = await supabase
      .from("misto_technicke_fotky")
      .select("id")
      .eq("misto_id", params.mistoId)
      .eq("source_poptavka_fotka_id", fotka.id)
      .maybeSingle();

    if (existingError) {
      failed += 1;
      continue;
    }

    if (existing?.id) {
      skipped += 1;
      continue;
    }

    const { error: insertError } = await supabase.from("misto_technicke_fotky").insert({
      misto_id: params.mistoId,
      zakazka_id: params.zakazkaId,
      autor_id: null,
      storage_bucket: fotka.storage_bucket,
      storage_path: fotka.storage_path,
      typ: mapPoptavkaFotkaTypToMisto(fotka.typ),
      popis: fotka.popis,
      dulezite: false,
      original_filename: fotka.original_filename,
      mime_type: fotka.mime_type,
      size_bytes: fotka.size_bytes,
      source_poptavka_id: params.poptavkaId,
      source_poptavka_fotka_id: fotka.id,
      source_zakazka_id: params.zakazkaId,
    });

    if (insertError) {
      failed += 1;
      continue;
    }

    promoted += 1;
  }

  return {
    ok: failed === 0,
    promoted,
    skipped,
    failed,
    message: failed > 0 ? `Selhalo připojení ${failed} fotek.` : undefined,
  };
}
