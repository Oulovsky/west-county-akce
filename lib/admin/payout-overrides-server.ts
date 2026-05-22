import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWorkPayoutOverrideKey,
  type WorkPayoutOverrideRow,
} from "@/lib/admin/work-payout-override";

/** Načtení korekcí přes service role (po ověření admin/šéf na stránce nebo v action). */
export async function loadPayoutOverridesByKeys(
  zakazkaIds: string[],
  userIds: string[]
): Promise<{ overridesByKey: Map<string, WorkPayoutOverrideRow>; error: string | null }> {
  const overridesByKey = new Map<string, WorkPayoutOverrideRow>();
  const uniqueZakazkaIds = [...new Set(zakazkaIds.filter(Boolean))];
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  if (uniqueZakazkaIds.length === 0 || uniqueUserIds.length === 0) {
    return { overridesByKey, error: null };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dochazka_payout_overrides")
    .select("zakazka_id, user_id, override_amount_czk, correction_note, updated_by, updated_at")
    .in("zakazka_id", uniqueZakazkaIds)
    .in("user_id", uniqueUserIds);

  if (error) {
    return { overridesByKey, error: error.message };
  }

  for (const row of (data ?? []) as WorkPayoutOverrideRow[]) {
    overridesByKey.set(buildWorkPayoutOverrideKey(row.zakazka_id, row.user_id), row);
  }

  return { overridesByKey, error: null };
}

export function getPayoutOverridesAdminClient() {
  return createAdminClient();
}

/** Vlastní korekce zaměstnance — service role, vždy jen řádky daného user_id (obchází RLS read). */
export async function loadEmployeeOwnPayoutOverrides(userId: string): Promise<{
  overridesByKey: Map<string, WorkPayoutOverrideRow>;
  error: string | null;
}> {
  const overridesByKey = new Map<string, WorkPayoutOverrideRow>();
  if (!userId) {
    return { overridesByKey, error: null };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dochazka_payout_overrides")
    .select("zakazka_id, user_id, override_amount_czk, correction_note, updated_by, updated_at")
    .eq("user_id", userId);

  if (error) {
    return { overridesByKey, error: error.message };
  }

  for (const row of (data ?? []) as WorkPayoutOverrideRow[]) {
    overridesByKey.set(buildWorkPayoutOverrideKey(row.zakazka_id, row.user_id), row);
  }

  return { overridesByKey, error: null };
}
