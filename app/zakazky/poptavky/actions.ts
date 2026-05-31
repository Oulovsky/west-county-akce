"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppAdminOrSef } from "@/lib/auth/admin-access-server";
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

  const { supabase } = await requireAppAdminOrSef();
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

  revalidatePath("/zakazky/poptavky");
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  redirect(`/zakazky/poptavky/${poptavkaId}?saved=revision`);
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

  const { supabase } = await requireAppAdminOrSef();
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

  revalidatePath("/zakazky/poptavky");
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  redirect(`/zakazky/poptavky/${poptavkaId}?saved=rejected`);
}

export async function approvePoptavkaAction(formData: FormData) {
  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();

  if (!poptavkaId) {
    redirectWithError("/zakazky/poptavky", "missing_id");
  }

  const { supabase, user } = await requireAppAdminOrSef();
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

  const { supabase } = await requireAppAdminOrSef();
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
