import type { SupabaseClient } from "@supabase/supabase-js";

export type PayoutEmployeeProfile = {
  user_id: string;
  email: string | null;
  jmeno: string | null;
  prijmeni: string | null;
  hodinovy_naklad_akce: number | string | null;
  bank_account_number: string | null;
  bank_code: string | null;
  iban: string | null;
};

const PAYOUT_PROFILE_SELECT =
  "user_id, email, jmeno, prijmeni, hodinovy_naklad_akce, bank_account_number, bank_code, iban";

/** Vždy načte aktuální bankovní údaje z profiles (žádná cache na úrovni docházky). */
export async function loadPayoutEmployeeProfiles(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<{ profilesById: Map<string, PayoutEmployeeProfile>; error: string | null }> {
  const profilesById = new Map<string, PayoutEmployeeProfile>();
  const uniqueIds = [...new Set(userIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return { profilesById, error: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(PAYOUT_PROFILE_SELECT)
    .in("user_id", uniqueIds);

  if (error) {
    return { profilesById, error: error.message };
  }

  for (const profile of (data ?? []) as PayoutEmployeeProfile[]) {
    profilesById.set(profile.user_id, profile);
  }

  return { profilesById, error: null };
}
