"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function getRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`Chybí ${label}.`);
  }
  return value;
}

export async function addPlaceTechnicalNoteAction(formData: FormData) {
  const mistoId = getRequiredText(formData, "misto_id", "ID místa");
  const zakazkaId = String(formData.get("zakazka_id") ?? "").trim() || null;
  const typ = getRequiredText(formData, "typ", "typ poznámky");
  const text = getRequiredText(formData, "text", "text poznámky");
  const dulezite = formData.get("dulezite") === "on";
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Pro přidání interní poznámky musíte být přihlášeni.");
  }

  const { error } = await supabase.from("misto_technicke_poznamky").insert({
    misto_id: mistoId,
    zakazka_id: zakazkaId,
    autor_id: userData.user.id,
    typ,
    text,
    dulezite,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/mista/${mistoId}`);
  if (zakazkaId) {
    revalidatePath(`/zakazky/${zakazkaId}`);
  }
}
