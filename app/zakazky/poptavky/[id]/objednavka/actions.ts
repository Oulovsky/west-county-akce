"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireInternalWriteAdminOrSef } from "@/lib/auth/admin-access-server";
import { mergeObjednavkaDraftFromFormData } from "@/lib/client-portal/poptavka-objednavka-draft-form";
import { prepareObjednavkaDraftForSave } from "@/lib/client-portal/poptavka-objednavka-pricing-server";
import {
  getPortalAppBaseUrl,
  outboundResultToEmailQuery,
  trySendPoptavkaBindingOrderOutbound,
} from "@/lib/client-portal/poptavka-email-server";
import {
  parsePoptavkaObjednavkaDraftData,
  savePoptavkaObjednavkaDraft,
} from "@/lib/client-portal/poptavka-objednavka-draft-server";
import {
  buildPoptavkaObjednavkaUrl,
  createPoptavkaObjednavkaLinkFromDraft,
} from "@/lib/client-portal/poptavka-objednavka-link-server";
import {
  canSendPoptavkaBindingOrder,
  loadInternalPoptavkaDetail,
} from "@/lib/client-portal/poptavka-internal-server";

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

function redirectObjednavkaEditor(
  poptavkaId: string,
  query: Record<string, string | undefined>
): never {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  redirect(`/zakazky/poptavky/${poptavkaId}/objednavka${qs ? `?${qs}` : ""}`);
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
    redirectObjednavkaEditor(poptavkaId, { error: "not_found" });
  }

  const baseDraft = parsePoptavkaObjednavkaDraftData(row.draft_data);
  const merged = mergeObjednavkaDraftFromFormData(baseDraft, formData);
  const prepared = await prepareObjednavkaDraftForSave(supabase, merged);

  const result = await savePoptavkaObjednavkaDraft(supabase, draftId, prepared);

  if (!result.ok) {
    const errorCode =
      result.error === "read_only" ? "read_only" : result.error === "not_found" ? "not_found" : "save_failed";
    redirectObjednavkaEditor(poptavkaId, { error: errorCode });
  }

  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath(`/zakazky/poptavky/${poptavkaId}/objednavka`);

  void user;

  redirectObjednavkaEditor(poptavkaId, { saved: "1" });
}

export async function sendPoptavkaObjednavkaAction(formData: FormData) {
  const draftId = String(formData.get("draft_id") ?? "").trim();
  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();

  if (!draftId || !poptavkaId) {
    redirect(`/zakazky/poptavky/${poptavkaId || ""}?error=missing_id`);
  }

  const { supabase, user } = await requireInternalWriteAdminOrSef();
  const detail = await loadInternalPoptavkaDetail(supabase, poptavkaId);

  if (!detail) {
    redirectObjednavkaEditor(poptavkaId, { error: "not_found" });
  }

  if (!canSendPoptavkaBindingOrder(detail.stav)) {
    redirectObjednavkaEditor(poptavkaId, { error: "invalid_state" });
  }

  const row = await loadDraftRowByIdInternal(supabase, draftId);

  if (!row || row.poptavka_id !== poptavkaId) {
    redirectObjednavkaEditor(poptavkaId, { error: "not_found" });
  }

  const baseDraft = parsePoptavkaObjednavkaDraftData(row.draft_data);
  const merged = mergeObjednavkaDraftFromFormData(baseDraft, formData);
  const prepared = await prepareObjednavkaDraftForSave(supabase, merged, {
    freezeBreakdown: true,
  });

  const saveResult = await savePoptavkaObjednavkaDraft(supabase, draftId, prepared);

  if (!saveResult.ok) {
    const errorCode =
      saveResult.error === "read_only"
        ? "read_only"
        : saveResult.error === "not_found"
          ? "not_found"
          : "save_failed";
    redirectObjednavkaEditor(poptavkaId, { error: errorCode });
  }

  const baseUrl = getPortalAppBaseUrl(await headers());

  const linkResult = await createPoptavkaObjednavkaLinkFromDraft(supabase, poptavkaId, {
    draftId,
    preparedByUserId: user.id,
    baseUrl,
    emailTo: merged.klient.email,
  });

  if (!linkResult.ok) {
    const linkError =
      linkResult.error === "invalid_state"
        ? "invalid_state"
        : linkResult.error === "draft_not_found" || linkResult.error === "draft_poptavka_mismatch"
          ? "not_found"
          : linkResult.error === "draft_not_active"
            ? "read_only"
            : linkResult.error === "poptavka_update_failed"
              ? "invalid_state"
              : "link_failed";
    redirectObjednavkaEditor(poptavkaId, { error: linkError });
  }

  const publicLink =
    linkResult.publicUrl ??
    (baseUrl.trim()
      ? buildPoptavkaObjednavkaUrl(baseUrl, linkResult.rawToken)
      : linkResult.relativeUrl);

  const emailResult = await trySendPoptavkaBindingOrderOutbound({
    cisloPoptavky: detail.cislo_poptavky,
    publicLink,
    emailTo: linkResult.link.email_to,
  });

  if (emailResult.ok && emailResult.sent) {
    const now = new Date().toISOString();
    await supabase
      .from("poptavka_objednavka_links")
      .update({
        email_sent_at: now,
        stav: "email_odeslan",
      })
      .eq("link_id", linkResult.link.link_id);
  }

  revalidatePath("/zakazky/poptavky");
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath(`/zakazky/poptavky/${poptavkaId}/objednavka`);
  revalidatePath(`/zakazky/poptavky/${poptavkaId}/objednavka/nahled`);
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  revalidatePath("/portal/poptavky");

  const emailQuery = outboundResultToEmailQuery(emailResult);
  const query: Record<string, string | undefined> = {
    order: "sent",
    email: emailQuery,
  };

  if (emailQuery !== "sent") {
    query.token = linkResult.rawToken;
  }

  redirectObjednavkaEditor(poptavkaId, query);
}
