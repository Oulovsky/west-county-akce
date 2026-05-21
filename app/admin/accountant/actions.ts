"use server";

import { revalidatePath } from "next/cache";
import { assertAppAdmin } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";

export type AccountantConfig = {
  id: string;
  jmeno: string | null;
  nazev_firmy: string | null;
  adresa: string | null;
  telefon: string | null;
  email: string | null;
  poznamka: string | null;
  aktivni: boolean;
};

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
  return assertAppAdmin();
}

export async function getAccountantConfig() {
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("ucetni_konfigurace")
    .select("*")
    .eq("aktivni", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as AccountantConfig | null;
}

export async function saveAccountantConfig(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const id = textOrNull(formData.get("id"));
    const payload = {
      jmeno: textOrNull(formData.get("jmeno")),
      nazev_firmy: textOrNull(formData.get("nazev_firmy")),
      adresa: textOrNull(formData.get("adresa")),
      telefon: textOrNull(formData.get("telefon")),
      email: textOrNull(formData.get("email")),
      poznamka: textOrNull(formData.get("poznamka")),
      aktivni: true,
      updated_at: new Date().toISOString(),
    };

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return { ok: false, error: "Email účetní nemá platný formát." };
    }

    if (!id) {
      await supabase.from("ucetni_konfigurace").update({ aktivni: false }).eq("aktivni", true);
    }

    const result = id
      ? await supabase.from("ucetni_konfigurace").update(payload).eq("id", id)
      : await supabase.from("ucetni_konfigurace").insert(payload);

    if (result.error) return { ok: false, error: result.error.message };

    revalidatePath("/admin");
    revalidatePath("/admin/faktury");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
