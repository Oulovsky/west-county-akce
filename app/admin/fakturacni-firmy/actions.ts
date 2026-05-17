"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FakturacniFirma } from "@/lib/fakturacni-firmy";

type ActionResult = {
  ok: boolean;
  error?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Neznámá chyba";
}

function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (error) throw new Error(error.message);
  if (!profile || profile.role !== "admin") throw new Error("Forbidden");

  return supabase;
}

export async function getFakturacniFirmy() {
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("fakturacni_firmy")
    .select("*")
    .order("aktivni", { ascending: false })
    .order("vychozi", { ascending: false })
    .order("nazev", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as FakturacniFirma[];
}

export async function saveFakturacniFirma(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = textOrNull(formData.get("id"));
    const nazev = textOrNull(formData.get("nazev"));
    const vychozi = formData.get("vychozi") === "on";

    if (!nazev) return { ok: false, error: "Vyplň název fakturační firmy." };

    if (vychozi) {
      const { error } = await supabase
        .from("fakturacni_firmy")
        .update({ vychozi: false, updated_at: new Date().toISOString() })
        .eq("vychozi", true);

      if (error) return { ok: false, error: error.message };
    }

    const payload = {
      nazev,
      ulice: textOrNull(formData.get("ulice")),
      mesto: textOrNull(formData.get("mesto")),
      psc: textOrNull(formData.get("psc")),
      ico: textOrNull(formData.get("ico")),
      dic: textOrNull(formData.get("dic")),
      email: textOrNull(formData.get("email")),
      telefon: textOrNull(formData.get("telefon")),
      bankovni_ucet: textOrNull(formData.get("bankovni_ucet")),
      iban: textOrNull(formData.get("iban")),
      swift: textOrNull(formData.get("swift")),
      poznamka: textOrNull(formData.get("poznamka")),
      aktivni: formData.get("aktivni") !== "off",
      vychozi,
      updated_at: new Date().toISOString(),
    };

    const result = id
      ? await supabase.from("fakturacni_firmy").update(payload).eq("id", id)
      : await supabase.from("fakturacni_firmy").insert(payload);

    if (result.error) return { ok: false, error: result.error.message };

    revalidatePath("/admin");
    revalidatePath("/zakazky");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deactivateFakturacniFirma(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("fakturacni_firmy")
      .update({ aktivni: false, vychozi: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function setDefaultFakturacniFirma(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const now = new Date().toISOString();
    const { error: clearError } = await supabase
      .from("fakturacni_firmy")
      .update({ vychozi: false, updated_at: now })
      .eq("vychozi", true);

    if (clearError) return { ok: false, error: clearError.message };

    const { error } = await supabase
      .from("fakturacni_firmy")
      .update({ aktivni: true, vychozi: true, updated_at: now })
      .eq("id", id);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
