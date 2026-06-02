"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";
import {
  buildSkladPolozkaDeleteBlockedMessage,
  foreignKeyBlockerReasonFromMessage,
  getSkladovaPolozkaDeleteBlockers,
  isForeignKeyViolation,
} from "@/lib/sklad/deletePolozka";
import { createClient } from "@/lib/supabase/server";

function redirectWithDeleteError(skladovaPolozkaId: string, message: string): never {
  redirect(`/sklad/${skladovaPolozkaId}?deleteError=${encodeURIComponent(message)}`);
}

export async function deletePolozkaAction(formData: FormData) {
  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);

  const skladovaPolozkaId = String(formData.get("skladova_polozka_id") || "").trim();

  if (!skladovaPolozkaId) {
    redirect("/sklad/sprava?deleteError=missing_id");
  }

  const { reasons, checkError } = await getSkladovaPolozkaDeleteBlockers(
    supabase,
    skladovaPolozkaId
  );

  if (checkError) {
    redirectWithDeleteError(
      skladovaPolozkaId,
      `Položku nelze smazat: ${checkError}`
    );
  }

  if (reasons.length > 0) {
    redirectWithDeleteError(
      skladovaPolozkaId,
      buildSkladPolozkaDeleteBlockedMessage(reasons)
    );
  }

  const { error: poskozeniError } = await supabase
    .from("hlaseni_poskozeni")
    .delete()
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (poskozeniError) {
    if (isForeignKeyViolation(poskozeniError)) {
      redirectWithDeleteError(
        skladovaPolozkaId,
        buildSkladPolozkaDeleteBlockedMessage([
          foreignKeyBlockerReasonFromMessage(poskozeniError.message) ??
            "má evidované poškození / historii (hlaseni_poskozeni)",
        ])
      );
    }
    redirectWithDeleteError(skladovaPolozkaId, `Položku nelze smazat: ${poskozeniError.message}`);
  }

  const { error: kusyError } = await supabase
    .from("sklad_polozky_kusy")
    .delete()
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (kusyError) {
    if (isForeignKeyViolation(kusyError)) {
      redirectWithDeleteError(
        skladovaPolozkaId,
        buildSkladPolozkaDeleteBlockedMessage([
          foreignKeyBlockerReasonFromMessage(kusyError.message) ??
            "má založené kusy (sklad_polozky_kusy)",
        ])
      );
    }
    redirectWithDeleteError(skladovaPolozkaId, `Položku nelze smazat: ${kusyError.message}`);
  }

  const { error: deleteError } = await supabase
    .from("skladove_polozky")
    .delete()
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (deleteError) {
    if (isForeignKeyViolation(deleteError)) {
      redirectWithDeleteError(
        skladovaPolozkaId,
        buildSkladPolozkaDeleteBlockedMessage([
          foreignKeyBlockerReasonFromMessage(deleteError.message) ??
            "položka je stále použita v databázi (cizí klíč)",
        ])
      );
    }
    redirectWithDeleteError(skladovaPolozkaId, `Položku nelze smazat: ${deleteError.message}`);
  }

  revalidatePath("/sklad");
  revalidatePath("/sklad/sprava");
  redirect("/sklad/sprava");
}
