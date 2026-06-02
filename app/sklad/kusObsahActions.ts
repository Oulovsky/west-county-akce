"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";
import { insertKusIntoCase, removeKusFromCase } from "@/lib/sklad/kusObsah";
import { createClient } from "@/lib/supabase/server";

function resolveChildKusId(formData: FormData) {
  const fromScan = String(formData.get("child_kus_id") ?? "").trim();
  const fromSelect = String(formData.get("child_kus_id_select") ?? "").trim();
  return fromScan || fromSelect;
}

function redirectAfterObsahAction(
  parentKusId: string,
  returnPolozkaId: string | null,
  params: { ok?: string; error?: string }
) {
  const search = new URLSearchParams();
  if (returnPolozkaId) {
    search.set("obsahCase", parentKusId);
  }
  if (params.ok) search.set("obsah", params.ok);
  if (params.error) search.set("obsahError", params.error);
  const query = search.toString();

  if (returnPolozkaId) {
    redirect(`/sklad/${returnPolozkaId}${query ? `?${query}` : ""}`);
  }

  redirect(`/sklad/kus/${parentKusId}${query ? `?${query}` : ""}`);
}

export async function insertKusIntoCaseAction(formData: FormData) {
  const parentKusId = String(formData.get("parent_kus_id") ?? "").trim();
  const returnPolozkaId = String(formData.get("return_polozka_id") ?? "").trim() || null;
  const childKusId = resolveChildKusId(formData);
  const pozice = String(formData.get("pozice") ?? "").trim();
  const poznamka = String(formData.get("poznamka") ?? "").trim();

  if (!parentKusId) {
    throw new Error("Chybí ID case.");
  }
  if (!childKusId) {
    redirectAfterObsahAction(parentKusId, returnPolozkaId, {
      error: "Vyberte kus ze seznamu nebo zadejte kus_id / naskenujte QR.",
    });
  }

  const supabase = await createClient();

  try {
    await assertInternalWriteAccess(supabase);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { parent, child } = await insertKusIntoCase(supabase, {
      parentKusId,
      childKusId,
      pozice: pozice || null,
      poznamka: poznamka || null,
      userId: user?.id ?? null,
    });

    revalidatePath(`/sklad/kus/${parentKusId}`);
    revalidatePath(`/sklad/kus/${childKusId}`);
    revalidatePath(`/sklad/${parent.skladova_polozka_id}`);
    revalidatePath(`/sklad/${child.skladova_polozka_id}`);
    if (returnPolozkaId) {
      revalidatePath(`/sklad/${returnPolozkaId}`);
    }

    redirectAfterObsahAction(parentKusId, returnPolozkaId, { ok: "inserted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vložení kusu do case se nezdařilo.";
    redirectAfterObsahAction(parentKusId, returnPolozkaId, { error: message });
  }
}

export async function removeKusFromCaseAction(formData: FormData) {
  const parentKusId = String(formData.get("parent_kus_id") ?? "").trim();
  const returnPolozkaId = String(formData.get("return_polozka_id") ?? "").trim() || null;
  const obsahId = String(formData.get("obsah_id") ?? "").trim();

  if (!parentKusId || !obsahId) {
    throw new Error("Chybí ID case nebo vazby.");
  }

  const supabase = await createClient();

  try {
    await assertInternalWriteAccess(supabase);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { childKusId, parentKusId: resolvedParentId } = await removeKusFromCase(supabase, {
      obsahId,
      userId: user?.id ?? null,
    });

    const { data: childKus } = await supabase
      .from("sklad_polozky_kusy")
      .select("skladova_polozka_id")
      .eq("kus_id", childKusId)
      .maybeSingle();

    const { data: parentKus } = await supabase
      .from("sklad_polozky_kusy")
      .select("skladova_polozka_id")
      .eq("kus_id", resolvedParentId)
      .maybeSingle();

    revalidatePath(`/sklad/kus/${resolvedParentId}`);
    revalidatePath(`/sklad/kus/${childKusId}`);
    if (parentKus?.skladova_polozka_id) {
      revalidatePath(`/sklad/${parentKus.skladova_polozka_id}`);
    }
    if (childKus?.skladova_polozka_id) {
      revalidatePath(`/sklad/${childKus.skladova_polozka_id}`);
    }
    if (returnPolozkaId) {
      revalidatePath(`/sklad/${returnPolozkaId}`);
    }

    redirectAfterObsahAction(parentKusId, returnPolozkaId, { ok: "removed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vyjití kusu z case se nezdařilo.";
    redirectAfterObsahAction(parentKusId, returnPolozkaId, { error: message });
  }
}
