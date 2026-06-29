import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPoptavkaFotkaExtension,
  isAllowedPoptavkaFotkaTyp,
  resolvePoptavkaPhotoMimeType,
  validatePoptavkaPhotoFile,
  type PoptavkaFotkaWithUrl,
} from "@/lib/client-portal/poptavka-fotky-shared";
import type { PoptavkaFotka } from "@/lib/client-portal/types";
import { POPTAVKA_FOTKY_BUCKET } from "@/lib/client-portal/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type { PoptavkaFotkaWithUrl };

export async function loadPoptavkaFotkyWithUrls(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<PoptavkaFotkaWithUrl[]> {
  const { data, error } = await supabase
    .from("poptavka_fotky")
    .select(
      "id, poptavka_id, storage_bucket, storage_path, typ, popis, poradi, original_filename, mime_type, size_bytes, created_at"
    )
    .eq("poptavka_id", poptavkaId)
    .order("poradi", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const admin = createAdminClient();
  const rows = (data ?? []) as PoptavkaFotka[];

  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await admin.storage
        .from(row.storage_bucket || POPTAVKA_FOTKY_BUCKET)
        .createSignedUrl(row.storage_path, 60 * 60);

      return {
        ...row,
        signedUrl: signed?.signedUrl ?? null,
      };
    })
  );
}

async function signPoptavkaFotkaRow(row: PoptavkaFotka): Promise<PoptavkaFotkaWithUrl> {
  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(row.storage_bucket || POPTAVKA_FOTKY_BUCKET)
    .createSignedUrl(row.storage_path, 60 * 60);
  return {
    ...row,
    signedUrl: signed?.signedUrl ?? null,
  };
}

export type UploadPoptavkaFotkaInput = {
  file: File;
  typ: string;
  popis?: string;
  clientId?: string;
};

export type UploadPoptavkaFotkaItemResult =
  | { ok: true; clientId: string | null; fotka: PoptavkaFotkaWithUrl }
  | { ok: false; clientId: string | null; code: string; message: string };

export async function uploadPoptavkaFotkyForClient(
  supabase: SupabaseClient,
  poptavkaId: string,
  files: File[],
  types: string[],
  descriptions: string[],
  clientIds?: string[]
): Promise<UploadPoptavkaFotkaItemResult[]> {
  const admin = createAdminClient();
  const results: UploadPoptavkaFotkaItemResult[] = [];

  const { count, error: countError } = await supabase
    .from("poptavka_fotky")
    .select("id", { count: "exact", head: true })
    .eq("poptavka_id", poptavkaId);

  if (countError) {
    throw new Error(countError.message);
  }

  let poradi = count ?? 0;

  for (const [index, file] of files.entries()) {
    const clientId = clientIds?.[index] ?? null;
    const validation = validatePoptavkaPhotoFile(file);
    if (!validation.ok) {
      results.push({
        ok: false,
        clientId,
        code: validation.code,
        message: validation.message,
      });
      continue;
    }

    const typ = isAllowedPoptavkaFotkaTyp(types[index] ?? "") ? types[index]! : "jina";
    const mimeType = validation.mimeType;
    const extension = getPoptavkaFotkaExtension(mimeType);
    const storagePath = `poptavka/${poptavkaId}/${randomUUID()}.${extension}`;

    try {
      const body = await file.arrayBuffer();
      const { error: uploadError } = await admin.storage
        .from(POPTAVKA_FOTKY_BUCKET)
        .upload(storagePath, body, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error("[poptavka fotky] storage upload failed", {
          poptavkaId,
          message: uploadError.message,
        });
        results.push({
          ok: false,
          clientId,
          code: "storage_upload_failed",
          message: "Nahrání fotky do úložiště se nezdařilo.",
        });
        continue;
      }

      const metadataRow = {
        poptavka_id: poptavkaId,
        storage_bucket: POPTAVKA_FOTKY_BUCKET,
        storage_path: storagePath,
        typ,
        popis: descriptions[index]?.trim() || null,
        poradi,
        original_filename: file.name || null,
        mime_type: mimeType,
        size_bytes: file.size,
      };
      poradi += 1;

      const { data: inserted, error: insertError } = await supabase
        .from("poptavka_fotky")
        .insert(metadataRow)
        .select(
          "id, poptavka_id, storage_bucket, storage_path, typ, popis, poradi, original_filename, mime_type, size_bytes, created_at"
        )
        .single();

      if (insertError || !inserted) {
        console.error("[poptavka fotky] db insert failed", {
          poptavkaId,
          message: insertError?.message ?? "no row",
        });
        await admin.storage.from(POPTAVKA_FOTKY_BUCKET).remove([storagePath]);
        results.push({
          ok: false,
          clientId,
          code: "db_insert_failed",
          message: "Uložení fotky do databáze se nezdařilo.",
        });
        continue;
      }

      const fotka = await signPoptavkaFotkaRow(inserted as PoptavkaFotka);
      results.push({ ok: true, clientId, fotka });
    } catch (error) {
      console.error("[poptavka fotky] upload item failed", {
        poptavkaId,
        message: error instanceof Error ? error.message : "unknown",
      });
      results.push({
        ok: false,
        clientId,
        code: "upload_failed",
        message: "Nahrání fotky se nezdařilo.",
      });
    }
  }

  return results;
}

export async function deletePoptavkaFotkaForClient(
  supabase: SupabaseClient,
  poptavkaId: string,
  fotkaId: string
) {
  const { data: row, error } = await supabase
    .from("poptavka_fotky")
    .select("id, storage_bucket, storage_path")
    .eq("id", fotkaId)
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!row) {
    throw new Error("Fotka nenalezena.");
  }

  const admin = createAdminClient();
  await admin.storage.from(row.storage_bucket || POPTAVKA_FOTKY_BUCKET).remove([row.storage_path]);

  const { error: deleteError } = await supabase
    .from("poptavka_fotky")
    .delete()
    .eq("id", fotkaId)
    .eq("poptavka_id", poptavkaId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

export { resolvePoptavkaPhotoMimeType };

const TECHNIKA_FOTKA_TYPY = new Set([
  "rozvadec",
  "prijezd",
  "plocha_stage",
  "povrch_pristup",
  "jina",
  "misto_akce",
]);

export async function copyTechnikaPhotosFromSourcePoptavka(
  supabase: SupabaseClient,
  targetPoptavkaId: string,
  sourcePoptavkaId: string
): Promise<PoptavkaFotkaWithUrl[]> {
  if (targetPoptavkaId === sourcePoptavkaId) {
    return loadPoptavkaFotkyWithUrls(supabase, targetPoptavkaId);
  }

  const { data: sourceRows, error: sourceError } = await supabase
    .from("poptavka_fotky")
    .select(
      "id, storage_bucket, storage_path, typ, popis, poradi, original_filename, mime_type, size_bytes"
    )
    .eq("poptavka_id", sourcePoptavkaId)
    .order("poradi", { ascending: true });

  if (sourceError) {
    throw new Error(sourceError.message);
  }

  const technikaRows = (sourceRows ?? []).filter((row) =>
    TECHNIKA_FOTKA_TYPY.has(row.typ as string)
  );

  if (technikaRows.length === 0) {
    return [];
  }

  const admin = createAdminClient();

  const { count, error: countError } = await supabase
    .from("poptavka_fotky")
    .select("id", { count: "exact", head: true })
    .eq("poptavka_id", targetPoptavkaId);

  if (countError) {
    throw new Error(countError.message);
  }

  let poradi = count ?? 0;
  const copied: PoptavkaFotkaWithUrl[] = [];

  for (const row of technikaRows) {
    const bucket = (row.storage_bucket as string) || POPTAVKA_FOTKY_BUCKET;
    const sourcePath = row.storage_path as string;
    const mimeType = (row.mime_type as string) || "image/jpeg";
    const extension = getPoptavkaFotkaExtension(mimeType);
    const targetPath = `poptavka/${targetPoptavkaId}/${randomUUID()}.${extension}`;

    const { data: blob, error: downloadError } = await admin.storage
      .from(bucket)
      .download(sourcePath);

    if (downloadError || !blob) {
      console.error("[poptavka fotky] copy download failed", {
        sourcePoptavkaId,
        targetPoptavkaId,
        message: downloadError?.message ?? "no blob",
      });
      continue;
    }

    const body = await blob.arrayBuffer();
    const { error: uploadError } = await admin.storage.from(POPTAVKA_FOTKY_BUCKET).upload(targetPath, body, {
      contentType: mimeType,
      upsert: false,
    });

    if (uploadError) {
      console.error("[poptavka fotky] copy upload failed", {
        sourcePoptavkaId,
        targetPoptavkaId,
        message: uploadError.message,
      });
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("poptavka_fotky")
      .insert({
        poptavka_id: targetPoptavkaId,
        storage_bucket: POPTAVKA_FOTKY_BUCKET,
        storage_path: targetPath,
        typ: row.typ,
        popis: row.popis,
        poradi,
        original_filename: row.original_filename,
        mime_type: mimeType,
        size_bytes: row.size_bytes,
      })
      .select(
        "id, poptavka_id, storage_bucket, storage_path, typ, popis, poradi, original_filename, mime_type, size_bytes, created_at"
      )
      .single();

    if (insertError || !inserted) {
      await admin.storage.from(POPTAVKA_FOTKY_BUCKET).remove([targetPath]);
      console.error("[poptavka fotky] copy db insert failed", {
        sourcePoptavkaId,
        targetPoptavkaId,
        message: insertError?.message ?? "no row",
      });
      continue;
    }

    poradi += 1;
    copied.push(await signPoptavkaFotkaRow(inserted as PoptavkaFotka));
  }

  return copied;
}

export async function deletePoptavkaDraftForClient(
  supabase: SupabaseClient,
  poptavkaId: string
) {
  const { data: row, error } = await supabase
    .from("poptavky")
    .select("poptavka_id, stav")
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!row) {
    throw new Error("Koncept nenalezen.");
  }

  if (row.stav !== "koncept") {
    throw new Error("Smazat lze pouze neodeslaný koncept.");
  }

  const { data: fotky, error: fotkyError } = await supabase
    .from("poptavka_fotky")
    .select("storage_bucket, storage_path")
    .eq("poptavka_id", poptavkaId);

  if (fotkyError) {
    throw new Error(fotkyError.message);
  }

  const admin = createAdminClient();
  const pathsByBucket = new Map<string, string[]>();

  for (const fotka of fotky ?? []) {
    const bucket = (fotka.storage_bucket as string) || POPTAVKA_FOTKY_BUCKET;
    const path = fotka.storage_path as string;
    const list = pathsByBucket.get(bucket) ?? [];
    list.push(path);
    pathsByBucket.set(bucket, list);
  }

  for (const [bucket, paths] of pathsByBucket) {
    if (paths.length === 0) continue;
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) {
      console.error("[poptavka draft delete] storage cleanup failed", {
        poptavkaId,
        bucket,
        message: removeError.message,
      });
    }
  }

  const { error: deleteError } = await supabase
    .from("poptavky")
    .delete()
    .eq("poptavka_id", poptavkaId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}
