"use server";

import { revalidatePath } from "next/cache";
import { hashClientApprovalToken } from "@/lib/client-approval";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { createAdminClient } from "@/lib/supabase/admin";
import { setZakazkaWorkflowStatus } from "@/lib/zakazka-workflow";
import { clearZakazkaCriticalChangePending } from "@/lib/zakazka-critical-changes";

type ApprovalDecision = "approve" | "decline";

function formError(errorMessage: string) {
  return { ok: false, errorMessage };
}

async function loadValidLink(rawToken: string) {
  const supabase = createAdminClient();
  const tokenHash = hashClientApprovalToken(rawToken);

  const { data, error } = await supabase
    .from("zakazka_approval_links")
    .select("link_id, zakazka_id, revoked_at, approved_at, declined_at, approval_snapshot")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const link = data as {
    link_id: string;
    zakazka_id: string;
    revoked_at: string | null;
    approved_at: string | null;
    declined_at: string | null;
    approval_snapshot: { version?: number } | null;
  } | null;

  if (!link || link.revoked_at || link.approved_at || link.declined_at) {
    return { supabase, link: null };
  }
  if (link.approval_snapshot?.version !== 1) {
    await logZakazkaHistory(supabase, {
      zakazkaId: link.zakazka_id,
      eventType: "client_approval_legacy_link_blocked",
      actorId: null,
      title: "Starší schvalovací odkaz bez snapshotu byl zablokován.",
      detail: "Klientské schválení nebylo přijato, protože odkaz neobsahuje verzovaný snapshot.",
      metadata: { link_id: link.link_id, source: "public_approval" },
    });
    return { supabase, link: null };
  }

  const { data: zakazka, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zrusena, workflow_stav")
    .eq("zakazka_id", link.zakazka_id)
    .maybeSingle();

  if (zakazkaError) throw new Error(zakazkaError.message);
  if (zakazka?.zrusena || zakazka?.workflow_stav === "zruseno") {
    return { supabase, link: null };
  }

  return { supabase, link };
}

export async function submitClientApprovalDecisionAction(
  rawToken: string,
  decision: ApprovalDecision,
  reason: string
) {
  const token = rawToken.trim();
  if (!token) return formError("Chybí token schválení.");

  const { supabase, link } = await loadValidLink(token);
  if (!link) {
    return formError("Odkaz už není platný. Požádejte prosím organizátora akce o nový odkaz.");
  }

  const now = new Date().toISOString();
  const declinedReason = reason.trim();

  if (decision === "decline" && !declinedReason) {
    return formError("Při odmítnutí prosím napište důvod nebo komentář.");
  }

  const linkUpdate =
    decision === "approve"
      ? {
          stav: "approved",
          approved_at: now,
          declined_at: null,
          declined_reason: null,
        }
      : {
          stav: "declined",
          approved_at: null,
          declined_at: now,
          declined_reason: declinedReason,
        };

  const { error: linkError } = await supabase
    .from("zakazka_approval_links")
    .update(linkUpdate)
    .eq("link_id", link.link_id);

  if (linkError) throw new Error(linkError.message);

  const zakazkaUpdate =
    decision === "approve"
      ? {
          client_approval_status: "approved",
          client_approval_approved_at: now,
          client_approval_declined_at: null,
          client_approval_declined_reason: null,
        }
      : {
          client_approval_status: "declined",
          client_approval_declined_at: now,
          client_approval_declined_reason: declinedReason,
        };

  const { error: zakazkaError } = await supabase
    .from("zakazky")
    .update(zakazkaUpdate)
    .eq("zakazka_id", link.zakazka_id);

  if (zakazkaError) throw new Error(zakazkaError.message);

  if (decision === "approve") {
    await clearZakazkaCriticalChangePending(supabase, {
      zakazkaId: link.zakazka_id,
      actorId: null,
      source: "client_reapproval",
    });

    const workflowResult = await setZakazkaWorkflowStatus(supabase, {
      zakazkaId: link.zakazka_id,
      nextStatus: "schvaleno_klientem",
      actorId: null,
      source: "client_approval_approved",
      metadata: { link_id: link.link_id },
    });
    if (!workflowResult.ok) {
      await logZakazkaHistory(supabase, {
        zakazkaId: link.zakazka_id,
        eventType: "workflow_reapproval_without_status_change",
        actorId: null,
        title: "Klient potvrdil změny bez změny hlavního workflow stavu.",
        detail: workflowResult.error ?? null,
        metadata: { link_id: link.link_id },
      });
    }
  }

  await logZakazkaHistory(supabase, {
    zakazkaId: link.zakazka_id,
    eventType: decision === "approve" ? "client_approval_approved" : "client_approval_declined",
    actorId: null,
    title:
      decision === "approve"
        ? "Klient schválil finální podobu zakázky."
        : "Klient odmítl finální podobu zakázky.",
    detail: decision === "decline" ? `Důvod: ${declinedReason}` : null,
    metadata: { link_id: link.link_id, source: "public_approval" },
  });

  revalidatePath(`/zakazky/${link.zakazka_id}`);
  revalidatePath("/zakazky");

  return { ok: true, errorMessage: null };
}
