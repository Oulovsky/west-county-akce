"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { createNotificationsForRoles, createNotificationsForUsers } from "@/lib/notifications";
import { setZakazkaWorkflowStatus } from "@/lib/zakazka-workflow";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { insertSkladKusHistorie } from "@/lib/sklad/kusHistorie";

function getRequiredText(formData: FormData, name: string, label: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error(`${label} je povinný.`);
  return value;
}

export async function cancelZakazkaAction(formData: FormData) {
  const zakazkaId = getRequiredText(formData, "zakazka_id", "ID zakázky");
  const reason = getRequiredText(formData, "zruseno_duvod", "Důvod zrušení");
  const invoiceOverrideReason = String(formData.get("invoice_override_reason") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Pro zrušení zakázky musíte být přihlášeni.");
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("zakazka_faktury")
    .select("id, cislo_dokladu")
    .eq("zakazka_id", zakazkaId)
    .limit(1)
    .maybeSingle();

  if (invoiceError) throw new Error(invoiceError.message);
  if (invoice && !invoiceOverrideReason) {
    throw new Error("Zakázka už má vystavenou fakturu. Pro zrušení je povinný důvod override.");
  }

  const now = new Date().toISOString();
  const { error: zakazkaError } = await supabase
    .from("zakazky")
    .update({
      zrusena: true,
      zruseno_at: now,
      zruseno_by: user.id,
      zruseno_duvod: reason,
      zruseno_invoice_override_reason: invoiceOverrideReason,
      logistika_stav: "zruseno",
      workflow_change_pending: false,
      workflow_change_pending_at: null,
      workflow_change_pending_by: null,
      workflow_change_summary: null,
    })
    .eq("zakazka_id", zakazkaId);

  if (zakazkaError) throw new Error(zakazkaError.message);

  const workflowResult = await setZakazkaWorkflowStatus(supabase, {
    zakazkaId,
    nextStatus: "zruseno",
    actorId: user.id,
    source: "cancel_zakazka",
    detail: `Zakázka byla zrušena. Důvod: ${reason}`,
    metadata: {
      reason,
      invoice_id: invoice?.id ?? null,
      invoice_number: invoice?.cislo_dokladu ?? null,
      invoice_override_reason: invoiceOverrideReason,
    },
  });

  if (!workflowResult.ok) throw new Error(workflowResult.error);

  const { data: activeAssignments, error: activeAssignmentsError } = await supabase
    .from(SKLAD_TABLE.zakazkaKusy)
    .select("id, kus_id, stav")
    .eq("zakazka_id", zakazkaId)
    .in("stav", ["rezervovano", "nalozeno", "vratit", "poskozeno"]);

  if (activeAssignmentsError) throw new Error(activeAssignmentsError.message);

  const activeIds = (activeAssignments ?? []).map((row) => row.id).filter(Boolean);
  if (activeIds.length > 0) {
    const { error: releaseError } = await supabase
      .from(SKLAD_TABLE.zakazkaKusy)
      .update({ stav: "vraceno" })
      .in("id", activeIds);

    if (releaseError) throw new Error(releaseError.message);

    for (const assignment of activeAssignments ?? []) {
      await insertSkladKusHistorie(supabase, {
        kusId: assignment.kus_id,
        zakazkaId,
        typAkce: "vraceno",
        poznamka: `Kus uvolněn zrušením zakázky. Důvod: ${reason}`,
      });
    }
  }

  await supabase
    .from("zakazka_approval_links")
    .update({ revoked_at: now, stav: "revoked_by_cancellation" })
    .eq("zakazka_id", zakazkaId)
    .is("revoked_at", null);

  await supabase
    .from("zakazka_client_links")
    .update({ revoked_at: now, stav: "revoked_by_cancellation" })
    .eq("zakazka_id", zakazkaId)
    .is("revoked_at", null);

  await supabase
    .from("zakazky")
    .update({
      client_approval_status: "draft",
      client_approval_declined_at: null,
      client_approval_declined_reason: null,
    })
    .eq("zakazka_id", zakazkaId);

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "zakazka_cancelled",
    actorId: user.id,
    title: "Zakázka byla zrušena.",
    detail: invoiceOverrideReason
      ? `Důvod: ${reason}. Override faktury: ${invoiceOverrideReason}`
      : `Důvod: ${reason}`,
    metadata: {
      reason,
      released_kusy_count: activeIds.length,
      approval_links_revoked: true,
      questionnaire_links_revoked: true,
      invoice_id: invoice?.id ?? null,
      invoice_number: invoice?.cislo_dokladu ?? null,
      invoice_override_reason: invoiceOverrideReason,
    },
  });

  const { data: people } = await supabase
    .from("zakazka_lide")
    .select("user_id")
    .eq("zakazka_id", zakazkaId);

  await createNotificationsForUsers(
    supabase,
    (people ?? []).map((row: { user_id: string | null }) => row.user_id),
    {
      type: "zakazka_cancelled",
      priority: "critical",
      title: "Zakázka byla zrušena",
      message: reason,
      relatedZakazkaId: zakazkaId,
      actionUrl: `/moje/zakazky/${zakazkaId}`,
      dedupeKeyPrefix: `zakazka-cancelled:${zakazkaId}`,
    }
  );

  await createNotificationsForRoles(supabase, ["admin", "sef", "skladnik"], {
    type: "zakazka_cancelled_admin",
    priority: "critical",
    title: "Zakázka byla zrušena",
    message: reason,
    relatedZakazkaId: zakazkaId,
    actionUrl: `/zakazky/${zakazkaId}`,
    dedupeKeyPrefix: `zakazka-cancelled-admin:${zakazkaId}`,
  });

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/zakazky");
  revalidatePath("/moje");
  revalidatePath("/kalendar");
  revalidatePath("/kalendar/lide");
  revalidatePath("/sklad/sprava");

  redirect(`/zakazky/${zakazkaId}`);
}
