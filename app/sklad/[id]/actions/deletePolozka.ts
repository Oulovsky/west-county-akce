"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";
import { executeSkladovaPolozkaDelete } from "@/lib/sklad/deletePolozka";
import { createClient } from "@/lib/supabase/server";

function redirectWithDeleteError(skladovaPolozkaId: string, message: string): never {
  redirect(`/sklad/${skladovaPolozkaId}?deleteError=${encodeURIComponent(message)}`);
}

export async function deletePolozkaAction(formData: FormData) {
  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);

  const skladovaPolozkaId = String(formData.get("skladova_polozka_id") || "").trim();

  if (!skladovaPolozkaId) {
    redirect("/sklad?deleteError=missing_id");
  }

  const result = await executeSkladovaPolozkaDelete(supabase, skladovaPolozkaId);

  if (!result.ok) {
    redirectWithDeleteError(skladovaPolozkaId, result.error);
  }

  revalidatePath("/sklad");
  revalidatePath("/sklad/sprava");
  redirect("/sklad");
}
