"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  confirmPoptavkaObjednavkaByToken,
  rejectPoptavkaObjednavkaByToken,
  type PoptavkaObjednavkaDecisionClientResult,
} from "@/lib/client-portal/poptavka-objednavka-link-server";

async function readRequestMeta() {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headersList.get("x-real-ip") ?? null;
  const userAgent = headersList.get("user-agent") ?? null;

  return { ip, userAgent };
}

function revalidateAfterDecision(rawToken: string, poptavkaId: string) {
  const trimmed = rawToken.trim();
  revalidatePath(`/poptavka-objednavka/${encodeURIComponent(trimmed)}`);
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath("/zakazky/poptavky");
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
}

async function runDecision(
  rawToken: string,
  resultPromise: Promise<PoptavkaObjednavkaDecisionClientResult>
) {
  const token = rawToken.trim();
  if (!token) {
    return { ok: false as const, errorMessage: "Odkaz není platný." };
  }

  const result = await resultPromise;

  if (result.ok) {
    revalidateAfterDecision(token, result.poptavkaId);
  }

  return result;
}

export async function confirmPoptavkaObjednavkaAction(rawToken: string) {
  return runDecision(
    rawToken,
    confirmPoptavkaObjednavkaByToken(rawToken, await readRequestMeta())
  );
}

export async function rejectPoptavkaObjednavkaAction(rawToken: string, reason: string) {
  return runDecision(
    rawToken,
    rejectPoptavkaObjednavkaByToken(rawToken, reason, await readRequestMeta())
  );
}
