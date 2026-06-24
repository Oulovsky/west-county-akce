"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireInternalWriteAdminOrSef } from "@/lib/auth/admin-access-server";
import {
  getPortalAppBaseUrl,
  outboundResultToEmailQuery,
  trySendPoptavkaOutbound,
} from "@/lib/client-portal/poptavka-email-server";
import {
  canInternalActOnPoptavka,
  loadInternalPoptavkaDetail,
} from "@/lib/client-portal/poptavka-internal-server";

function redirectWithError(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

export async function returnPoptavkaToRevisionAction(formData: FormData) {
  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  const duvod = String(formData.get("duvod") ?? "").trim();

  if (!poptavkaId) {
    redirectWithError("/zakazky/poptavky", "missing_id");
  }

  if (!duvod) {
    redirectWithError(`/zakazky/poptavky/${poptavkaId}`, "missing_reason");
  }

  const { supabase } = await requireInternalWriteAdminOrSef();
  const detail = await loadInternalPoptavkaDetail(supabase, poptavkaId);

  if (!detail) {
    redirectWithError("/zakazky/poptavky", "not_found");
  }

  if (!canInternalActOnPoptavka(detail.stav)) {
    redirectWithError(`/zakazky/poptavky/${poptavkaId}`, "invalid_state");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("poptavky")
    .update({
      stav: "v_revizi",
      zamitnuto_duvod: duvod,
      updated_at: now,
    })
    .eq("poptavka_id", poptavkaId);

  if (error) {
    redirectWithError(`/zakazky/poptavky/${poptavkaId}`, "save_failed");
  }

  const refreshedDetail = (await loadInternalPoptavkaDetail(supabase, poptavkaId)) ?? detail;

  const emailResult = await trySendPoptavkaOutbound({
    kind: "revision",
    detail: refreshedDetail,
    baseUrl: getPortalAppBaseUrl(await headers()),
    duvod,
  });

  revalidatePath("/zakazky/poptavky");
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  revalidatePath("/portal/poptavky");

  const emailQuery = outboundResultToEmailQuery(emailResult);

  redirect(`/zakazky/poptavky/${poptavkaId}?saved=revision&email=${encodeURIComponent(emailQuery)}`);
}

export async function rejectPoptavkaAction(formData: FormData) {
  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  const duvod = String(formData.get("duvod") ?? "").trim();

  if (!poptavkaId) {
    redirectWithError("/zakazky/poptavky", "missing_id");
  }

  if (!duvod) {
    redirectWithError(`/zakazky/poptavky/${poptavkaId}`, "missing_reason");
  }

  const { supabase } = await requireInternalWriteAdminOrSef();
  const detail = await loadInternalPoptavkaDetail(supabase, poptavkaId);

  if (!detail) {
    redirectWithError("/zakazky/poptavky", "not_found");
  }

  if (!canInternalActOnPoptavka(detail.stav)) {
    redirectWithError(`/zakazky/poptavky/${poptavkaId}`, "invalid_state");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("poptavky")
    .update({
      stav: "zamitnuta",
      zamitnuto_duvod: duvod,
      schvalil_user_id: null,
      schvaleno_at: null,
      updated_at: now,
    })
    .eq("poptavka_id", poptavkaId);

  if (error) {
    redirectWithError(`/zakazky/poptavky/${poptavkaId}`, "save_failed");
  }

  const refreshedDetail = (await loadInternalPoptavkaDetail(supabase, poptavkaId)) ?? detail;

  const emailResult = await trySendPoptavkaOutbound({
    kind: "rejected",
    detail: refreshedDetail,
    baseUrl: getPortalAppBaseUrl(await headers()),
    duvod,
  });

  revalidatePath("/zakazky/poptavky");
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  redirect(
    `/zakazky/poptavky/${poptavkaId}?saved=rejected&email=${encodeURIComponent(outboundResultToEmailQuery(emailResult))}`
  );
}

export async function approvePoptavkaAction(formData: FormData) {
  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();

  if (!poptavkaId) {
    redirectWithError("/zakazky/poptavky", "missing_id");
  }

  const { supabase, user } = await requireInternalWriteAdminOrSef();
  const detail = await loadInternalPoptavkaDetail(supabase, poptavkaId);

  if (!detail) {
    redirectWithError("/zakazky/poptavky", "not_found");
  }

  if (!canInternalActOnPoptavka(detail.stav)) {
    redirectWithError(`/zakazky/poptavky/${poptavkaId}`, "invalid_state");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("poptavky")
    .update({
      stav: "schvalena",
      schvalil_user_id: user.id,
      schvaleno_at: now,
      zamitnuto_duvod: null,
      updated_at: now,
    })
    .eq("poptavka_id", poptavkaId);

  if (error) {
    redirectWithError(`/zakazky/poptavky/${poptavkaId}`, "save_failed");
  }

  revalidatePath("/zakazky/poptavky");
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  redirect(`/zakazky/poptavky/${poptavkaId}?saved=approved`);
}

export async function updatePoptavkaInterniPoznamkaAction(formData: FormData) {
  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  const interniPoznamka = String(formData.get("interni_poznamka") ?? "").trim();

  if (!poptavkaId) {
    redirectWithError("/zakazky/poptavky", "missing_id");
  }

  const { supabase } = await requireInternalWriteAdminOrSef();
  const detail = await loadInternalPoptavkaDetail(supabase, poptavkaId);

  if (!detail) {
    redirectWithError("/zakazky/poptavky", "not_found");
  }

  const { error } = await supabase
    .from("poptavky")
    .update({
      interni_poznamka: interniPoznamka || null,
      updated_at: new Date().toISOString(),
    })
    .eq("poptavka_id", poptavkaId);

  if (error) {
    redirectWithError(`/zakazky/poptavky/${poptavkaId}`, "save_failed");
  }

  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  redirect(`/zakazky/poptavky/${poptavkaId}?saved=note`);
}

export async function convertPoptavkaToZakazkaAction(formData: FormData) {
  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();

  if (!poptavkaId) {
    redirectWithError("/zakazky/poptavky", "missing_id");
  }

  const { supabase } = await requireInternalWriteAdminOrSef();
  const { convertPoptavkaToZakazka } = await import(
    "@/lib/client-portal/convert-poptavka-to-zakazka"
  );

  const result = await convertPoptavkaToZakazka(supabase, poptavkaId);

  if (!result.ok) {
    redirectWithError(`/zakazky/poptavky/${poptavkaId}`, result.error);
  }

  revalidatePath("/zakazky/poptavky");
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  revalidatePath("/portal/poptavky");
  revalidatePath("/portal/zakazky");
  redirect(`/zakazky/poptavky/${poptavkaId}?saved=converted&zakazka=${result.zakazkaId}`);
}
