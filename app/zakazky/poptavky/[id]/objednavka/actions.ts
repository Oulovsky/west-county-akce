"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireInternalWriteAdminOrSef } from "@/lib/auth/admin-access-server";
import { mergeObjednavkaDraftFromFormData } from "@/lib/client-portal/poptavka-objednavka-draft-form";
import {
  parsePoptavkaObjednavkaDraftData,
  savePoptavkaObjednavkaDraft,
} from "@/lib/client-portal/poptavka-objednavka-draft-server";

async function loadDraftRowByIdInternal(
  supabase: Awaited<ReturnType<typeof requireInternalWriteAdminOrSef>>["supabase"],
  draftId: string
) {
  const { data, error } = await supabase
    .from("poptavka_objednavka_drafts")
    .select("draft_id, poptavka_id, stav, draft_data")
    .eq("draft_id", draftId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as { draft_id: string; poptavka_id: string; stav: string; draft_data: unknown } | null;
}

export async function savePoptavkaObjednavkaDraftAction(formData: FormData) {
  const draftId = String(formData.get("draft_id") ?? "").trim();
  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();

  if (!draftId || !poptavkaId) {
    redirect(`/zakazky/poptavky/${poptavkaId || ""}?error=missing_id`);
  }

  const { supabase, user } = await requireInternalWriteAdminOrSef();
  const row = await loadDraftRowByIdInternal(supabase, draftId);

  if (!row || row.poptavka_id !== poptavkaId) {
    redirect(`/zakazky/poptavky/${poptavkaId}/objednavka?error=not_found`);
  }

  const baseDraft = parsePoptavkaObjednavkaDraftData(row.draft_data);
  const merged = mergeObjednavkaDraftFromFormData(baseDraft, formData);

  const result = await savePoptavkaObjednavkaDraft(supabase, draftId, merged);

  if (!result.ok) {
    const errorCode =
      result.error === "read_only" ? "read_only" : result.error === "not_found" ? "not_found" : "save_failed";
    redirect(`/zakazky/poptavky/${poptavkaId}/objednavka?error=${encodeURIComponent(errorCode)}`);
  }

  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath(`/zakazky/poptavky/${poptavkaId}/objednavka`);

  void user;

  redirect(`/zakazky/poptavky/${poptavkaId}/objednavka?saved=1`);
}
