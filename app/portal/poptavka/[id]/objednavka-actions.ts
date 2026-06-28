"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import {
  confirmPoptavkaObjednavkaFromPortal,
  rejectPoptavkaObjednavkaFromPortal,
  type PoptavkaObjednavkaDecisionClientResult,
} from "@/lib/client-portal/poptavka-objednavka-link-server";
import { createClient } from "@/lib/supabase/server";

async function readRequestMeta() {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? null;
  const userAgent = headersList.get("user-agent") ?? null;

  return { ip, userAgent };
}

function revalidateAfterPortalDecision(poptavkaId: string) {
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  revalidatePath("/portal/poptavky");
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath("/zakazky/poptavky");
  revalidatePath("/zakazky");
}

async function runPortalDecision(
  poptavkaId: string,
  resultPromise: Promise<PoptavkaObjednavkaDecisionClientResult>
) {
  const trimmed = poptavkaId.trim();
  if (!trimmed) {
    return { ok: false as const, errorMessage: "Poptávka není platná." };
  }

  const result = await resultPromise;

  if (result.ok) {
    revalidateAfterPortalDecision(result.poptavkaId);
  }

  return result;
}

export async function confirmPoptavkaObjednavkaPortalAction(poptavkaId: string) {
  const supabase = await createClient();
  const session = await requireActiveClientPortalSession(supabase);
  const klientId = session.account.klient_id;
  if (!klientId) {
    return { ok: false as const, errorMessage: "Nemáte oprávnění k této poptávce." };
  }

  return runPortalDecision(
    poptavkaId,
    confirmPoptavkaObjednavkaFromPortal(poptavkaId, klientId, await readRequestMeta())
  );
}

export async function rejectPoptavkaObjednavkaPortalAction(poptavkaId: string, reason: string) {
  const supabase = await createClient();
  const session = await requireActiveClientPortalSession(supabase);
  const klientId = session.account.klient_id;
  if (!klientId) {
    return { ok: false as const, errorMessage: "Nemáte oprávnění k této poptávce." };
  }

  return runPortalDecision(
    poptavkaId,
    rejectPoptavkaObjednavkaFromPortal(poptavkaId, klientId, reason, await readRequestMeta())
  );
}
