import type { SupabaseClient } from "@supabase/supabase-js";

/** Cookie nastavená v /auth/callback po OAuth — jeden „měkký“ průchod middleware pro stabilizaci session. */
export const OAUTH_PROFILE_GATE_COOKIE = "wc_oauth_profile_gate";

export type EmployeeProfileRow = {
  user_id: string;
  email: string | null;
  role: string;
  aktivni: boolean | null;
  jmeno: string | null;
  prijmeni: string | null;
};

export {
  getAuthProvidersFromUser,
  isEmployeeLoginAllowed,
  isExplicitInternalRole,
  isProvisionedInternalProfile,
  usesEmailPasswordOnly,
  type EmployeeLoginAllowedOptions,
} from "@/lib/auth/internal-access-rules";

/**
 * Přístup do aplikace: řádek v public.profiles pro daného auth uživatele.
 * Admin má vždy přístup (i při aktivni = false). Ostatní jen pokud aktivni není false.
 */
export async function loadEmployeeProfile(
  supabase: SupabaseClient,
  userId: string
) {
  return supabase
    .from("profiles")
    .select("user_id, email, role, aktivni, jmeno, prijmeni")
    .eq("user_id", userId)
    .maybeSingle();
}
