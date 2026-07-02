import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isClientOnlyOrphanProfile,
  isExplicitInternalRole,
  isProvisionedInternalProfile,
  shouldShowInAdminEmployeeList,
} from "@/lib/auth/internal-access-rules";

export type RemoveSpuriousProfileResult = "none" | "kept_internal" | "removed";

export { shouldShowInAdminEmployeeList };

/**
 * Runtime cleanup po klientské registraci.
 * Nikdy nemazat profily s interní rolí (admin, sef, zamestnanec, …).
 * Mazat jen ne-interní orphan řádky u aktivního klientského účtu (edge case).
 */
export async function removeSpuriousProfileForClientOnlyUser(
  supabase: SupabaseClient,
  userId: string
): Promise<RemoveSpuriousProfileResult> {
  const { data: clientAccount, error: clientAccountError } = await supabase
    .from("client_accounts")
    .select("account_id, stav, klient_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (clientAccountError) {
    throw new Error(clientAccountError.message);
  }

  const hasActiveClientAccount =
    clientAccount?.stav === "active" && Boolean(clientAccount.klient_id);

  if (!hasActiveClientAccount) {
    return "none";
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, email, role, aktivni, jmeno, prijmeni")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!profile) {
    return "none";
  }

  // Skutečný interní profil (admin nebo interní role se jménem) — nikdy nemazat.
  if (isExplicitInternalRole(profile.role) && isProvisionedInternalProfile(profile)) {
    console.info("[client-profile-isolation] keep provisioned internal profile", {
      userId,
      email: profile.email,
      role: profile.role,
    });
    return "kept_internal";
  }

  // Neprovisioned orphan u klientského účtu (interní role bez jména) NEBO ne-interní řádek.
  const isOrphan =
    isClientOnlyOrphanProfile(profile, hasActiveClientAccount) ||
    !isExplicitInternalRole(profile.role);

  if (!isOrphan) {
    console.info("[client-profile-isolation] keep internal role profile", {
      userId,
      email: profile.email,
      role: profile.role,
    });
    return "kept_internal";
  }

  const { error: deleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  console.info("[client-profile-isolation] removed spurious orphan profile", {
    userId,
    email: profile.email,
    role: profile.role,
  });

  return "removed";
}
