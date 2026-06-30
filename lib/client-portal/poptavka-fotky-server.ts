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
import { logPoptavkaFotkyPersistStats, logPoptavkaFotkyLoadStats, normalizePoptavkaFotkyRows, getCanonicalSourceFotkaId, hasExistingPoptavkaFotkaDuplicate } from "@/lib/client-portal/poptavka-fotky-dedup";

export type { PoptavkaFotkaWithUrl };

const SIGNED_URL_TTL_SECONDS = 60 * 60;

const POPTAVKA_FOTKA_SELECT =
  "id, poptavka_id, storage_bucket, storage_path, thumbnail_storage_path, typ, popis, poradi, original_filename, mime_type, size_bytes, thumbnail_size_bytes, source_fotka_id, created_at" as const;

export async function loadPoptavkaFotkyMetadata(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<PoptavkaFotka[]> {
  const { data, error } = await supabase
    .from("poptavka_fotky")
    .select(POPTAVKA_FOTKA_SELECT)
    .eq("poptavka_id", poptavkaId)
    .order("poradi", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PoptavkaFotka[];
}

async function signStoragePath(bucket: string, path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return signed?.signedUrl ?? null;
}

export async function signPoptavkaFotkaThumbnailUrl(row: PoptavkaFotka): Promise<string | null> {
  const bucket = row.storage_bucket || POPTAVKA_FOTKY_BUCKET;
  if (row.thumbnail_storage_path) {
    return signStoragePath(bucket, row.thumbnail_storage_path);
  }
  return null;
}

export async function signPoptavkaFotkaOriginalUrl(row: PoptavkaFotka): Promise<string | null> {
  const bucket = row.storage_bucket || POPTAVKA_FOTKY_BUCKET;
  return signStoragePath(bucket, row.storage_path);
}

export async function signPoptavkaFotkaThumbnailUrls(
  rows: PoptavkaFotka[]
): Promise<PoptavkaFotkaWithUrl[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      thumbnailSignedUrl: await signPoptavkaFotkaThumbnailUrl(row),
      signedUrl: null,
    }))
  );
}

/** Načte metadata + paralelně podepíše jen náhledy (originál až na vyžádání). */
export async function loadPoptavkaFotkyWithThumbnailUrls(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<PoptavkaFotkaWithUrl[]> {
  const rawRows = await loadPoptavkaFotkyMetadata(supabase, poptavkaId);
  const { rows, duplicatesRemoved, byTyp } = normalizePoptavkaFotkyRows(rawRows);
  logPoptavkaFotkyLoadStats(
    poptavkaId,
    rawRows.length,
    rows.length,
    duplicatesRemoved,
    byTyp
  );
  return signPoptavkaFotkaThumbnailUrls(rows);
}

/** @deprecated Prefer loadPoptavkaFotkyWithThumbnailUrls — podepisuje jen náhledy. */
export async function loadPoptavkaFotkyWithUrls(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<PoptavkaFotkaWithUrl[]> {
  return loadPoptavkaFotkyWithThumbnailUrls(supabase, poptavkaId);
}

export async function loadPoptavkaFotkaOriginalSignedUrlForClient(
  supabase: SupabaseClient,
  poptavkaId: string,
  fotkaId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("poptavka_fotky")
    .select(POPTAVKA_FOTKA_SELECT)
    .eq("id", fotkaId)
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  return signPoptavkaFotkaOriginalUrl(data as PoptavkaFotka);
}

async function signPoptavkaFotkaRowAfterUpload(row: PoptavkaFotka): Promise<PoptavkaFotkaWithUrl> {
  const thumbnailSignedUrl = await signPoptavkaFotkaThumbnailUrl(row);
  return {
    ...row,
    thumbnailSignedUrl,
    signedUrl: null,
  };
}

async function uploadClientThumbnailFile(
  admin: ReturnType<typeof createAdminClient>,
  poptavkaId: string,
  thumbnailFile: File
): Promise<{ thumbnailPath: string; thumbnailSizeBytes: number } | null> {
  if (thumbnailFile.size <= 0) {
    return null;
  }

  const mimeType =
    thumbnailFile.type === "image/webp"
      ? "image/webp"
      : thumbnailFile.type === "image/jpeg"
        ? "image/jpeg"
        : "image/webp";
  const extension = mimeType === "image/jpeg" ? "jpg" : "webp";
  const thumbnailPath = `poptavka/${poptavkaId}/${randomUUID()}.${extension}`;

  try {
    const body = Buffer.from(await thumbnailFile.arrayBuffer());
    const { error: thumbUploadError } = await admin.storage
      .from(POPTAVKA_FOTKY_BUCKET)
      .upload(thumbnailPath, body, {
        contentType: mimeType,
        upsert: false,
      });

    if (thumbUploadError) {
      console.error("[poptavka fotky] client thumbnail upload failed", {
        poptavkaId,
        message: thumbUploadError.message,
      });
      return null;
    }

    return {
      thumbnailPath,
      thumbnailSizeBytes: thumbnailFile.size,
    };
  } catch (error) {
    console.error("[poptavka fotky] client thumbnail upload failed", {
      poptavkaId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
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
  clientIds?: string[],
  thumbnailFiles?: Array<File | null | undefined>
): Promise<UploadPoptavkaFotkaItemResult[]> {
  const admin = createAdminClient();
  const results: UploadPoptavkaFotkaItemResult[] = [];

  const existingCount = await countPoptavkaFotky(supabase, poptavkaId);
  logPoptavkaFotkyPersistStats("pending upload count", poptavkaId, {
    pendingUploadCount: files.length,
    existingKeptCount: existingCount,
  });

  let poradi = existingCount;
  let insertedCount = 0;

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
      const body = Buffer.from(await file.arrayBuffer());
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

      const thumbnailFile = thumbnailFiles?.[index] ?? null;
      const thumbnailResult =
        thumbnailFile && thumbnailFile.size > 0
          ? await uploadClientThumbnailFile(admin, poptavkaId, thumbnailFile)
          : null;

      const metadataRow = {
        poptavka_id: poptavkaId,
        storage_bucket: POPTAVKA_FOTKY_BUCKET,
        storage_path: storagePath,
        thumbnail_storage_path: thumbnailResult?.thumbnailPath ?? null,
        typ,
        popis: descriptions[index]?.trim() || null,
        poradi,
        original_filename: file.name || null,
        mime_type: mimeType,
        size_bytes: file.size,
        thumbnail_size_bytes: thumbnailResult?.thumbnailSizeBytes ?? null,
      };
      poradi += 1;

      const { data: inserted, error: insertError } = await supabase
        .from("poptavka_fotky")
        .insert(metadataRow)
        .select(POPTAVKA_FOTKA_SELECT)
        .single();

      if (insertError || !inserted) {
        console.error("[poptavka fotky] db insert failed", {
          poptavkaId,
          message: insertError?.message ?? "no row",
        });
        const pathsToRemove = [storagePath];
        if (thumbnailResult?.thumbnailPath) {
          pathsToRemove.push(thumbnailResult.thumbnailPath);
        }
        await admin.storage.from(POPTAVKA_FOTKY_BUCKET).remove(pathsToRemove);
        results.push({
          ok: false,
          clientId,
          code: "db_insert_failed",
          message: "Uložení fotky do databáze se nezdařilo.",
        });
        continue;
      }

      const fotka = await signPoptavkaFotkaRowAfterUpload(inserted as PoptavkaFotka);
      results.push({ ok: true, clientId, fotka });
      insertedCount += 1;
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

  logPoptavkaFotkyPersistStats("final count", poptavkaId, {
    pendingUploadCount: files.length,
    existingKeptCount: existingCount,
    copiedFromHistoryCount: 0,
    skippedDuplicateCount: Math.max(
      0,
      files.length - insertedCount - results.filter((row) => !row.ok).length
    ),
    finalCount: existingCount + insertedCount,
  });

  return results;
}

export async function deletePoptavkaFotkaForClient(
  supabase: SupabaseClient,
  poptavkaId: string,
  fotkaId: string
) {
  const { data: row, error } = await supabase
    .from("poptavka_fotky")
    .select("id, storage_bucket, storage_path, thumbnail_storage_path")
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
  const bucket = row.storage_bucket || POPTAVKA_FOTKY_BUCKET;
  const paths = [row.storage_path as string];
  if (row.thumbnail_storage_path) {
    paths.push(row.thumbnail_storage_path as string);
  }
  await admin.storage.from(bucket).remove(paths);

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

async function countPoptavkaFotky(supabase: SupabaseClient, poptavkaId: string) {
  const { count, error } = await supabase
    .from("poptavka_fotky")
    .select("id", { count: "exact", head: true })
    .eq("poptavka_id", poptavkaId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export type CopyTechnikaPhotosResult = {
  fotky: PoptavkaFotkaWithUrl[];
  copiedFromHistoryCount: number;
  skippedDuplicateCount: number;
  existingKeptCount: number;
  finalCount: number;
};

async function copyStorageObject(
  admin: ReturnType<typeof createAdminClient>,
  sourceBucket: string,
  sourcePath: string,
  targetPath: string,
  contentType: string
): Promise<boolean> {
  const { data: blob, error: downloadError } = await admin.storage
    .from(sourceBucket)
    .download(sourcePath);

  if (downloadError || !blob) {
    return false;
  }

  const body = await blob.arrayBuffer();
  const { error: uploadError } = await admin.storage.from(POPTAVKA_FOTKY_BUCKET).upload(targetPath, body, {
    contentType,
    upsert: false,
  });

  return !uploadError;
}

export async function copyTechnikaPhotosFromSourcePoptavka(
  supabase: SupabaseClient,
  targetPoptavkaId: string,
  sourcePoptavkaId: string
): Promise<CopyTechnikaPhotosResult> {
  const existingKeptCount = await countPoptavkaFotky(supabase, targetPoptavkaId);

  if (targetPoptavkaId === sourcePoptavkaId) {
    const fotky = await loadPoptavkaFotkyWithThumbnailUrls(supabase, targetPoptavkaId);
    logPoptavkaFotkyPersistStats("copied from history count", targetPoptavkaId, {
      existingKeptCount,
      copiedFromHistoryCount: 0,
      skippedDuplicateCount: 0,
      finalCount: fotky.length,
    });
    return {
      fotky,
      copiedFromHistoryCount: 0,
      skippedDuplicateCount: 0,
      existingKeptCount,
      finalCount: fotky.length,
    };
  }

  const [{ data: sourceRows, error: sourceError }, { data: existingTarget, error: existingError }] =
    await Promise.all([
      supabase
        .from("poptavka_fotky")
        .select(POPTAVKA_FOTKA_SELECT)
        .eq("poptavka_id", sourcePoptavkaId)
        .order("poradi", { ascending: true }),
      supabase
        .from("poptavka_fotky")
        .select(
          "id, source_fotka_id, typ, storage_path, original_filename, size_bytes, created_at"
        )
        .eq("poptavka_id", targetPoptavkaId),
    ]);

  if (sourceError) {
    throw new Error(sourceError.message);
  }
  if (existingError) {
    throw new Error(existingError.message);
  }

  const technikaRows = (sourceRows ?? []).filter((row) =>
    TECHNIKA_FOTKA_TYPY.has(row.typ as string)
  );

  const existingTargetRows = (existingTarget ?? []) as PoptavkaFotka[];

  console.info("[poptavka fotky copy] start", {
    sourcePoptavkaId,
    targetPoptavkaId,
    sourcePhotosCount: technikaRows.length,
    existingTargetCount: existingTargetRows.length,
  });

  if (technikaRows.length === 0) {
    logPoptavkaFotkyPersistStats("copied from history count", targetPoptavkaId, {
      existingKeptCount,
      copiedFromHistoryCount: 0,
      skippedDuplicateCount: 0,
      finalCount: existingKeptCount,
    });
    return {
      fotky: [],
      copiedFromHistoryCount: 0,
      skippedDuplicateCount: 0,
      existingKeptCount,
      finalCount: existingKeptCount,
    };
  }

  const admin = createAdminClient();
  let poradi = existingKeptCount;
  const copied: PoptavkaFotkaWithUrl[] = [];
  let copiedFromHistoryCount = 0;
  let skippedDuplicateCount = 0;

  for (const row of technikaRows) {
    const canonicalSourceFotkaId = getCanonicalSourceFotkaId(row as PoptavkaFotka);
    const candidate = {
      id: canonicalSourceFotkaId,
      typ: row.typ as string,
      source_fotka_id: canonicalSourceFotkaId,
      storage_path: row.storage_path as string,
      original_filename: row.original_filename as string | null,
      size_bytes: row.size_bytes as number | null,
    };

    if (hasExistingPoptavkaFotkaDuplicate(existingTargetRows, candidate)) {
      skippedDuplicateCount += 1;
      continue;
    }

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
        sourceFotkaId: canonicalSourceFotkaId,
        message: downloadError?.message ?? "no blob",
      });
      continue;
    }

    const body = Buffer.from(await blob.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(POPTAVKA_FOTKY_BUCKET).upload(targetPath, body, {
      contentType: mimeType,
      upsert: false,
    });

    if (uploadError) {
      console.error("[poptavka fotky] copy upload failed", {
        sourcePoptavkaId,
        targetPoptavkaId,
        sourceFotkaId: canonicalSourceFotkaId,
        message: uploadError.message,
      });
      continue;
    }

    let thumbnailPath: string | null = null;
    let thumbnailSizeBytes: number | null = null;
    const sourceThumbPath = row.thumbnail_storage_path as string | null;

    if (sourceThumbPath) {
      const copiedThumbPath = `poptavka/${targetPoptavkaId}/${randomUUID()}.webp`;
      const copiedThumb = await copyStorageObject(
        admin,
        bucket,
        sourceThumbPath,
        copiedThumbPath,
        "image/webp"
      );
      if (copiedThumb) {
        thumbnailPath = copiedThumbPath;
        thumbnailSizeBytes = (row.thumbnail_size_bytes as number | null) ?? null;
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("poptavka_fotky")
      .insert({
        poptavka_id: targetPoptavkaId,
        storage_bucket: POPTAVKA_FOTKY_BUCKET,
        storage_path: targetPath,
        thumbnail_storage_path: thumbnailPath,
        typ: row.typ,
        popis: row.popis,
        poradi,
        original_filename: row.original_filename,
        mime_type: mimeType,
        size_bytes: row.size_bytes,
        thumbnail_size_bytes: thumbnailSizeBytes,
        source_fotka_id: canonicalSourceFotkaId,
      })
      .select(POPTAVKA_FOTKA_SELECT)
      .single();

    if (insertError || !inserted) {
      const pathsToRemove = [targetPath];
      if (thumbnailPath) pathsToRemove.push(thumbnailPath);
      await admin.storage.from(POPTAVKA_FOTKY_BUCKET).remove(pathsToRemove);
      if (insertError?.code === "23505") {
        skippedDuplicateCount += 1;
        continue;
      }
      console.error("[poptavka fotky] copy db insert failed", {
        sourcePoptavkaId,
        targetPoptavkaId,
        sourceFotkaId: canonicalSourceFotkaId,
        message: insertError?.message ?? "no row",
      });
      continue;
    }

    poradi += 1;
    copiedFromHistoryCount += 1;
    existingTargetRows.push(inserted as PoptavkaFotka);
    copied.push(await signPoptavkaFotkaRowAfterUpload(inserted as PoptavkaFotka));
  }

  const finalCount = existingKeptCount + copiedFromHistoryCount;
  console.info("[poptavka fotky copy] done", {
    sourcePoptavkaId,
    targetPoptavkaId,
    sourcePhotosCount: technikaRows.length,
    copiedCount: copiedFromHistoryCount,
    skippedDuplicateCount,
    finalTargetCount: finalCount,
  });
  logPoptavkaFotkyPersistStats("copied from history count", targetPoptavkaId, {
    existingKeptCount,
    copiedFromHistoryCount,
    skippedDuplicateCount,
    finalCount,
  });
  logPoptavkaFotkyPersistStats("skipped duplicate count", targetPoptavkaId, {
    skippedDuplicateCount,
    finalCount,
  });
  logPoptavkaFotkyPersistStats("final count", targetPoptavkaId, {
    existingKeptCount,
    copiedFromHistoryCount,
    skippedDuplicateCount,
    finalCount,
  });

  return {
    fotky: copied,
    copiedFromHistoryCount,
    skippedDuplicateCount,
    existingKeptCount,
    finalCount,
  };
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
    .select("storage_bucket, storage_path, thumbnail_storage_path")
    .eq("poptavka_id", poptavkaId);

  if (fotkyError) {
    throw new Error(fotkyError.message);
  }

  const admin = createAdminClient();
  const pathsByBucket = new Map<string, string[]>();

  for (const fotka of fotky ?? []) {
    const bucket = (fotka.storage_bucket as string) || POPTAVKA_FOTKY_BUCKET;
    const list = pathsByBucket.get(bucket) ?? [];
    list.push(fotka.storage_path as string);
    if (fotka.thumbnail_storage_path) {
      list.push(fotka.thumbnail_storage_path as string);
    }
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
