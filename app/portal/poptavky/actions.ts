"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
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
import { createClient } from "@/lib/supabase/server";

function redirectWithError(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
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
  } catch {
    redirectWithError(`/portal/poptavka/${poptavkaId}`, "setups_failed");
  }

  revalidatePath("/portal/poptavky");
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  redirect(`/portal/poptavka/${poptavkaId}?saved=1`);
}
