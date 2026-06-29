import { NextResponse } from "next/server";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import {
  isFormDataUploadFile,
  isAllowedPoptavkaFotkaTyp,
  collectPoptavkaPhotoThumbnailsForUpload,
} from "@/lib/client-portal/poptavka-fotky-shared";
import { uploadPoptavkaFotkyForClient } from "@/lib/client-portal/poptavka-fotky-server";
import { summarizePhotoUploadBatch } from "@/lib/client-portal/poptavka-server-timing";
import { isPoptavkaEditable, loadPoptavkaDetail } from "@/lib/client-portal/poptavka-server";
import { createClient } from "@/lib/supabase/server";

function getStringList(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value ?? "").trim());
}

export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    await requireActiveClientPortalSession(supabase);
  } catch {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  if (!poptavkaId) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  const detail = await loadPoptavkaDetail(supabase, poptavkaId);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (!isPoptavkaEditable(detail)) {
    return NextResponse.json({ ok: false, error: "not_editable" }, { status: 403 });
  }

  const files = formData
    .getAll("photo_files")
    .filter(isFormDataUploadFile)
    .filter((value) => value.size > 0);
  const photoTypes = getStringList(formData, "photo_types");
  const photoDescriptions = getStringList(formData, "photo_descriptions");
  const clientIds = getStringList(formData, "photo_client_ids");

  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "no_files" }, { status: 400 });
  }

  for (const typ of photoTypes) {
    if (typ && !isAllowedPoptavkaFotkaTyp(typ)) {
      return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
    }
  }

  console.info("[poptavka fotky] api upload start", {
    poptavkaId,
    ...summarizePhotoUploadBatch(files),
  });

  try {
    const results = await uploadPoptavkaFotkyForClient(
      supabase,
      poptavkaId,
      files,
      photoTypes,
      photoDescriptions,
      clientIds,
      collectPoptavkaPhotoThumbnailsForUpload(files, clientIds, formData)
    );

    const uploaded = results.filter((row) => row.ok);
    const errors = results.filter((row): row is Extract<typeof row, { ok: false }> => !row.ok);

    console.info("[poptavka fotky] api upload done", {
      poptavkaId,
      uploadedCount: uploaded.length,
      errorCount: errors.length,
    });

    return NextResponse.json({
      ok: uploaded.length > 0 || errors.length === 0,
      uploaded: uploaded.map((row) => ({
        clientId: row.clientId,
        fotka: row.fotka,
      })),
      errors: errors.map((row) => ({
        clientId: row.clientId,
        code: row.code,
        message: row.message,
      })),
    });
  } catch (error) {
    console.error("[poptavka fotky] api upload failed", {
      poptavkaId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
  }
}
