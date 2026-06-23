"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";
import { rethrowIfNextRedirect } from "@/lib/next/isRedirectError";
import { createCaseContent } from "@/lib/sklad/createCaseContent";
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
  returnTo: "sprava" | "polozka",
  params: { ok?: string; error?: string; keepInsertForm?: boolean }
) {
  const search = new URLSearchParams();
  if (returnPolozkaId) {
    search.set("obsahCase", parentKusId);
    if (params.keepInsertForm) {
      search.set("obsahMode", "insert");
    }
  }
  if (params.ok) search.set("obsah", params.ok);
  if (params.error) search.set("obsahError", params.error);
  const query = search.toString();

  if (returnTo === "sprava" && returnPolozkaId) {
    search.set("obsahPolozka", returnPolozkaId);
    const spravaQuery = search.toString();
    redirect(`/sklad${spravaQuery ? `?${spravaQuery}` : ""}`);
  }

  if (returnPolozkaId) {
    redirect(`/sklad/${returnPolozkaId}${query ? `?${query}` : ""}`);
  }

  redirect(`/sklad/kus/${parentKusId}${query ? `?${query}` : ""}`);
}

function resolveReturnTo(formData: FormData): "sprava" | "polozka" {
  const raw = String(formData.get("return_to") ?? "polozka").trim();
  return raw === "sprava" ? "sprava" : "polozka";
}

export async function insertKusIntoCaseAction(formData: FormData) {
  const parentKusId = String(formData.get("parent_kus_id") ?? "").trim();
  const returnPolozkaId = String(formData.get("return_polozka_id") ?? "").trim() || null;
  const returnTo = resolveReturnTo(formData);
  const childKusId = resolveChildKusId(formData);
  const pozice = String(formData.get("pozice") ?? "").trim();
  const poznamka = String(formData.get("poznamka") ?? "").trim();

  if (!parentKusId) {
    throw new Error("Chybí ID case.");
  }
  if (!childKusId) {
    redirectAfterObsahAction(parentKusId, returnPolozkaId, returnTo, {
      error: "Vyberte kus ze seznamu nebo zadejte kus_id / naskenujte QR.",
      keepInsertForm: true,
    });
  }

  const supabase = await createClient();
  let errorMessage: string | null = null;

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
    if (returnTo === "sprava") {
      revalidatePath("/sklad");
  revalidatePath("/sklad/sprava");
    }
  } catch (error) {
    rethrowIfNextRedirect(error);
    errorMessage =
      error instanceof Error ? error.message : "Vložení kusu do case se nezdařilo.";
  }

  if (errorMessage) {
    redirectAfterObsahAction(parentKusId, returnPolozkaId, returnTo, {
      error: errorMessage,
      keepInsertForm: true,
    });
  }

  redirectAfterObsahAction(parentKusId, returnPolozkaId, returnTo, { ok: "inserted" });
}

export async function removeKusFromCaseAction(formData: FormData) {
  const parentKusId = String(formData.get("parent_kus_id") ?? "").trim();
  const returnPolozkaId = String(formData.get("return_polozka_id") ?? "").trim() || null;
  const returnTo = resolveReturnTo(formData);
  const obsahId = String(formData.get("obsah_id") ?? "").trim();

  if (!parentKusId || !obsahId) {
    throw new Error("Chybí ID case nebo vazby.");
  }

  const supabase = await createClient();
  let errorMessage: string | null = null;

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
    if (returnTo === "sprava") {
      revalidatePath("/sklad");
  revalidatePath("/sklad/sprava");
    }
  } catch (error) {
    rethrowIfNextRedirect(error);
    errorMessage =
      error instanceof Error ? error.message : "Vyjití kusu z case se nezdařilo.";
  }

  if (errorMessage) {
    redirectAfterObsahAction(parentKusId, returnPolozkaId, returnTo, { error: errorMessage });
  }

  redirectAfterObsahAction(parentKusId, returnPolozkaId, returnTo, { ok: "removed" });
}

export async function createCaseContentAction(formData: FormData) {
  const parentKusId = String(formData.get("parent_kus_id") ?? "").trim();
  const returnPolozkaId = String(formData.get("return_polozka_id") ?? "").trim() || null;
  const returnTo = resolveReturnTo(formData);
  const nazev = String(formData.get("nazev") ?? "").trim();
  const skladBlokId = String(formData.get("sklad_blok_id") ?? "").trim();
  const kategorieTechnikyId = String(formData.get("kategorie_techniky_id") ?? "").trim();
  const podkategorieTechnikyId =
    String(formData.get("podkategorie_techniky_id") ?? "").trim() || null;
  const jednotka = String(formData.get("jednotka") ?? "").trim();
  const technickyVlastnikId = String(formData.get("technicky_vlastnik_id") ?? "").trim();
  const poznamka = String(formData.get("poznamka") ?? "").trim();
  const countRaw = Number(String(formData.get("count") ?? "").trim());

  if (!parentKusId) {
    throw new Error("Chybí ID case.");
  }
  if (!nazev) {
    redirectAfterObsahAction(parentKusId, returnPolozkaId, returnTo, {
      error: "Zadejte název obsahu.",
      keepInsertForm: true,
    });
  }
  if (!Number.isFinite(countRaw) || countRaw < 1) {
    redirectAfterObsahAction(parentKusId, returnPolozkaId, returnTo, {
      error: "Počet kusů musí být alespoň 1.",
      keepInsertForm: true,
    });
  }

  const supabase = await createClient();
  let errorMessage: string | null = null;

  try {
    await assertInternalWriteAccess(supabase);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await createCaseContent(supabase, {
      parentKusId,
      nazev,
      skladBlokId,
      kategorieTechnikyId,
      podkategorieTechnikyId,
      jednotka,
      technickyVlastnikId,
      count: Math.floor(countRaw),
      poznamka: poznamka || null,
      userId: user?.id ?? null,
    });

    revalidatePath(`/sklad/kus/${parentKusId}`);
    for (const childKusId of result.insertedKusIds) {
      revalidatePath(`/sklad/kus/${childKusId}`);
    }
    revalidatePath(`/sklad/${result.contentPolozkaId}`);
    if (returnPolozkaId) {
      revalidatePath(`/sklad/${returnPolozkaId}`);
    }
    revalidatePath("/sklad");
  revalidatePath("/sklad/sprava");
  } catch (error) {
    rethrowIfNextRedirect(error);
    errorMessage =
      error instanceof Error
        ? error.message
        : "Vytvoření a vložení obsahu do case se nezdařilo.";
  }

  if (errorMessage) {
    redirectAfterObsahAction(parentKusId, returnPolozkaId, returnTo, {
      error: errorMessage,
      keepInsertForm: true,
    });
  }

  redirectAfterObsahAction(parentKusId, returnPolozkaId, returnTo, { ok: "created" });
}
