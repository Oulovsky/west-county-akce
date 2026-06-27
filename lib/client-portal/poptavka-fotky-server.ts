import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPoptavkaFotkaExtension,
  isAllowedPoptavkaFotkaTyp,
  resolvePoptavkaPhotoMimeType,
} from "@/lib/client-portal/poptavka-fotky-shared";
import type { PoptavkaFotka } from "@/lib/client-portal/types";
import { POPTAVKA_FOTKY_BUCKET } from "@/lib/client-portal/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type PoptavkaFotkaWithUrl = PoptavkaFotka & {
  signedUrl: string | null;
};

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

export async function uploadPoptavkaFotkyForClient(
  supabase: SupabaseClient,
  poptavkaId: string,
  files: File[],
  types: string[],
  descriptions: string[]
) {
  const admin = createAdminClient();
  const metadataRows = [];

  for (const [index, file] of files.entries()) {
    const typ = isAllowedPoptavkaFotkaTyp(types[index] ?? "") ? types[index] : "jina";
    const mimeType = resolvePoptavkaPhotoMimeType(file) ?? "image/jpeg";
    const extension = getPoptavkaFotkaExtension(mimeType);
    const storagePath = `poptavka/${poptavkaId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from(POPTAVKA_FOTKY_BUCKET)
      .upload(storagePath, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    metadataRows.push({
      poptavka_id: poptavkaId,
      storage_bucket: POPTAVKA_FOTKY_BUCKET,
      storage_path: storagePath,
      typ,
      popis: descriptions[index]?.trim() || null,
      poradi: index,
      original_filename: file.name || null,
      mime_type: mimeType || null,
      size_bytes: file.size,
    });
  }

  if (metadataRows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("poptavka_fotky").insert(metadataRows);
  if (insertError) {
    throw new Error(insertError.message);
  }
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
