import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isProvisionedInternalProfile } from "@/lib/auth/internal-access-rules";

export type RemoveSpuriousProfileResult = "none" | "kept_internal" | "removed";

/**
 * Odstraní řádek v profiles vytvořený automaticky při auth signup (trigger),
 * pokud jde o čistě klientský účet bez založeného interního profilu.
 */
export async function removeSpuriousProfileForClientOnlyUser(
  supabase: SupabaseClient,
  userId: string
): Promise<RemoveSpuriousProfileResult> {
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

  if (isProvisionedInternalProfile(profile)) {
    console.info("[client-profile-isolation] keep provisioned internal profile", {
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

  console.info("[client-profile-isolation] removed spurious profile for client-only user", {
    userId,
    email: profile.email,
    role: profile.role,
  });

  return "removed";
}

export function isProvisionedInternalEmployeeRow(row: {
  role: string;
  aktivni?: boolean | null;
  jmeno?: string | null;
  prijmeni?: string | null;
}) {
  return isProvisionedInternalProfile({
    role: row.role,
    aktivni: row.aktivni ?? null,
    jmeno: row.jmeno,
    prijmeni: row.prijmeni,
  });
}
