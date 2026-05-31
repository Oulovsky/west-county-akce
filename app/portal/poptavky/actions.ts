"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import {
  POPTAVKA_FOTKY_ALLOWED_MIME_TYPES,
  POPTAVKA_FOTKY_MAX_SIZE_BYTES,
} from "@/lib/client-portal/poptavka-fotky-shared";
import {
  deletePoptavkaFotkaForClient,
  uploadPoptavkaFotkyForClient,
} from "@/lib/client-portal/poptavka-fotky-server";
import {
  buildTechnikaRowPayload,
  parseTechnikaFormData,
} from "@/lib/client-portal/poptavka-technika-form";
import {
  buildPoptavkaRowPayload,
  parsePoptavkaFormData,
  validatePoptavkaForm,
} from "@/lib/client-portal/poptavka-form";
import {
  generateCisloPoptavky,
  isPoptavkaEditable,
  loadPoptavkaDetail,
} from "@/lib/client-portal/poptavka-server";
import { notifyInternalTeamAboutSubmittedPoptavka } from "@/lib/client-portal/poptavka-notifications-server";
import { createClient } from "@/lib/supabase/server";

function redirectWithError(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function getStringList(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value ?? "").trim());
}

async function assertEditablePoptavka(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poptavkaId: string
) {
  const detail = await loadPoptavkaDetail(supabase, poptavkaId);
  if (!detail) {
    throw new Error("NOT_FOUND");
  }
  if (!isPoptavkaEditable(detail)) {
    throw new Error("NOT_EDITABLE");
  }
  return detail;
}

async function upsertTechnickeUdaje(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poptavkaId: string,
  formData: FormData
) {
  const technikaValues = parseTechnikaFormData(formData);
  const payload = buildTechnikaRowPayload(technikaValues);

  const { data: existing } = await supabase
    .from("poptavka_technicke_udaje")
    .select("poptavka_id")
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (existing?.poptavka_id) {
    const { error } = await supabase
      .from("poptavka_technicke_udaje")
      .update(payload)
      .eq("poptavka_id", poptavkaId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("poptavka_technicke_udaje").insert({
    poptavka_id: poptavkaId,
    ...payload,
  });
  if (error) throw new Error(error.message);
}

async function replacePoptavkaSetups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poptavkaId: string,
  setupy: ReturnType<typeof parsePoptavkaFormData>["setupy"]
) {
  const { error: deleteError } = await supabase
    .from("poptavka_setupy")
    .delete()
    .eq("poptavka_id", poptavkaId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (setupy.length === 0) {
    return;
  }

  const rows = setupy.map((row, index) => ({
    poptavka_id: poptavkaId,
    setup_id: row.setup_id,
    mnozstvi: row.mnozstvi,
    poznamka_klienta: row.poznamka_klienta,
    poradi: index,
  }));

  const { error: insertError } = await supabase.from("poptavka_setupy").insert(rows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function createPoptavkaAction(formData: FormData) {
  const supabase = await createClient();
  const session = await requireActiveClientPortalSession(supabase);

  const values = parsePoptavkaFormData(formData);
  const validationError = validatePoptavkaForm(values);
  if (validationError) {
    redirectWithError("/portal/poptavka/nova", validationError);
  }

  const cisloPoptavky = await generateCisloPoptavky(supabase);
  const payload = buildPoptavkaRowPayload(values);

  const { data: created, error } = await supabase
    .from("poptavky")
    .insert({
      ...payload,
      cislo_poptavky: cisloPoptavky,
      klient_id: session.account.klient_id!,
      vytvoril_account_id: session.account.account_id,
      stav: "koncept",
    })
    .select("poptavka_id")
    .single();

  if (error || !created) {
    redirectWithError("/portal/poptavka/nova", "save_failed");
  }

  try {
    await replacePoptavkaSetups(supabase, created.poptavka_id, values.setupy);
  } catch {
    redirectWithError("/portal/poptavka/nova", "setups_failed");
  }

  revalidatePath("/portal/poptavky");
  redirect(`/portal/poptavka/${created.poptavka_id}?saved=1`);
}

export async function updatePoptavkaAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  if (!poptavkaId) {
    redirectWithError("/portal/poptavky", "missing_id");
  }

  const detail = await loadPoptavkaDetail(supabase, poptavkaId);
  if (!detail) {
    redirectWithError("/portal/poptavky", "not_found");
  }

  if (!isPoptavkaEditable(detail)) {
    redirectWithError(`/portal/poptavka/${poptavkaId}`, "not_editable");
  }

  const values = parsePoptavkaFormData(formData);
  const validationError = validatePoptavkaForm(values);
  if (validationError) {
    redirectWithError(`/portal/poptavka/${poptavkaId}`, validationError);
  }

  const payload = buildPoptavkaRowPayload(values);

  const { error } = await supabase
    .from("poptavky")
    .update(payload)
    .eq("poptavka_id", poptavkaId);

  if (error) {
    redirectWithError(`/portal/poptavka/${poptavkaId}`, "save_failed");
  }

  try {
    await replacePoptavkaSetups(supabase, poptavkaId, values.setupy);
    await upsertTechnickeUdaje(supabase, poptavkaId, formData);
  } catch {
    redirectWithError(`/portal/poptavka/${poptavkaId}`, "setups_failed");
  }

  revalidatePath("/portal/poptavky");
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  redirect(`/portal/poptavka/${poptavkaId}?saved=1`);
}

export async function uploadPoptavkaFotkyAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  if (!poptavkaId) {
    return { ok: false as const, error: "missing_id" };
  }

  try {
    await assertEditablePoptavka(supabase, poptavkaId);
  } catch (error) {
    const code = error instanceof Error ? error.message : "forbidden";
    return { ok: false as const, error: code === "NOT_FOUND" ? "not_found" : "not_editable" };
  }

  const files = formData
    .getAll("photo_files")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const photoTypes = getStringList(formData, "photo_types");
  const photoDescriptions = getStringList(formData, "photo_descriptions");

  if (files.length === 0) {
    return { ok: false as const, error: "no_files" };
  }

  for (const file of files) {
    if (!(POPTAVKA_FOTKY_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return { ok: false as const, error: "invalid_type" };
    }
    if (file.size > POPTAVKA_FOTKY_MAX_SIZE_BYTES) {
      return { ok: false as const, error: "file_too_large" };
    }
  }

  try {
    await uploadPoptavkaFotkyForClient(supabase, poptavkaId, files, photoTypes, photoDescriptions);
  } catch {
    return { ok: false as const, error: "upload_failed" };
  }

  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  return { ok: true as const, error: null };
}

export async function deletePoptavkaFotkaAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  const fotkaId = String(formData.get("fotka_id") ?? "").trim();

  if (!poptavkaId || !fotkaId) {
    return { ok: false as const, error: "missing_id" };
  }

  try {
    await assertEditablePoptavka(supabase, poptavkaId);
    await deletePoptavkaFotkaForClient(supabase, poptavkaId, fotkaId);
  } catch (error) {
    const code = error instanceof Error ? error.message : "forbidden";
    return { ok: false as const, error: code === "NOT_FOUND" ? "not_found" : "delete_failed" };
  }

  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  return { ok: true as const, error: null };
}

export async function submitPoptavkaAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  if (!poptavkaId) {
    redirectWithError("/portal/poptavky", "missing_id");
  }

  let detail;
  try {
    detail = await assertEditablePoptavka(supabase, poptavkaId);
  } catch {
    redirectWithError(`/portal/poptavka/${poptavkaId}`, "not_editable");
  }

  if (!detail.kontakt_jmeno || !detail.kontakt_email || !detail.misto_nazev || !detail.datum_od || !detail.datum_do) {
    redirectWithError(`/portal/poptavka/${poptavkaId}`, "submit_incomplete");
  }

  const wasRevision = detail.stav === "v_revizi";
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("poptavky")
    .update({
      stav: "odeslana",
      odeslano_at: now,
      zamitnuto_duvod: null,
      updated_at: now,
    })
    .eq("poptavka_id", poptavkaId);

  if (error) {
    redirectWithError(`/portal/poptavka/${poptavkaId}`, "submit_failed");
  }

  try {
    await notifyInternalTeamAboutSubmittedPoptavka({
      poptavkaId,
      cisloPoptavky: detail.cislo_poptavky,
      mistoNazev: detail.misto_nazev,
      isResubmit: wasRevision,
    });
  } catch (notifyError) {
    console.warn("Poptavka submit notification failed:", notifyError);
  }

  revalidatePath("/portal/poptavky");
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  revalidatePath("/zakazky/poptavky");
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  redirect(`/portal/poptavka/${poptavkaId}?submitted=1`);
}
