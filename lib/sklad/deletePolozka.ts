import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SKLAD_POLOZKA_DELETE_BLOCKED_BASE =
  "Položku nelze smazat, protože je použitá v zakázkách, setupech, kusech nebo historii.";

export function isForeignKeyViolation(error: PostgrestError | null | undefined) {
  if (!error) return false;
  return (
    error.code === "23503" ||
    error.message.includes("violates foreign key constraint")
  );
}

export function foreignKeyBlockerReasonFromMessage(message: string): string | null {
  if (message.includes("technika_na_zakazce")) {
    return "použito v zakázkách (technika_na_zakazce)";
  }
  if (message.includes("setup_polozky")) {
    return "použito v setupech (setup_polozky)";
  }
  if (message.includes("zakazka_kusy")) {
    return "kusy jsou přiřazeny k zakázkám (zakazka_kusy)";
  }
  if (message.includes("sklad_polozky_kusy")) {
    return "má založené kusy (sklad_polozky_kusy)";
  }
  if (message.includes("hlaseni_poskozeni")) {
    return "má evidované poškození / historii (hlaseni_poskozeni)";
  }
  return null;
}

export function buildSkladPolozkaDeleteBlockedMessage(reasons: string[]) {
  if (reasons.length === 0) {
    return SKLAD_POLOZKA_DELETE_BLOCKED_BASE;
  }

  return [SKLAD_POLOZKA_DELETE_BLOCKED_BASE, ...reasons.map((reason) => `• ${reason}`)].join(
    "\n"
  );
}

export async function getSkladovaPolozkaDeleteBlockers(
  supabase: SupabaseClient,
  skladovaPolozkaId: string
): Promise<{ reasons: string[]; checkError: string | null }> {
  const reasons: string[] = [];

  const [technikaRes, setupRes, kusyRes] = await Promise.all([
    supabase
      .from("technika_na_zakazce")
      .select("zakazka_id", { count: "exact", head: true })
      .eq("skladova_polozka_id", skladovaPolozkaId),
    supabase
      .from("setup_polozky")
      .select("setup_polozka_id", { count: "exact", head: true })
      .eq("skladova_polozka_id", skladovaPolozkaId),
    supabase
      .from("sklad_polozky_kusy")
      .select("kus_id")
      .eq("skladova_polozka_id", skladovaPolozkaId),
  ]);

  const checkErrors = [
    technikaRes.error?.message,
    setupRes.error?.message,
    kusyRes.error?.message,
  ].filter(Boolean);

  if (checkErrors.length > 0) {
    return { reasons: [], checkError: checkErrors[0] ?? "Nepodařilo se ověřit vazby položky." };
  }

  if ((technikaRes.count ?? 0) > 0) {
    reasons.push("použito v zakázkách (technika_na_zakazce)");
  }

  if ((setupRes.count ?? 0) > 0) {
    reasons.push("použito v setupech (setup_polozky)");
  }

  const kusIds = (kusyRes.data ?? []).map((row) => row.kus_id as string);

  if (kusIds.length > 0) {
    const { count: zakazkaKusyCount, error: zakazkaKusyError } = await supabase
      .from("zakazka_kusy")
      .select("id", { count: "exact", head: true })
      .in("kus_id", kusIds);

    if (zakazkaKusyError) {
      return { reasons: [], checkError: zakazkaKusyError.message };
    }

    if ((zakazkaKusyCount ?? 0) > 0) {
      reasons.push("kusy jsou přiřazeny k zakázkám (zakazka_kusy)");
    }
  }

  return { reasons, checkError: null };
}
