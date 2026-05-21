import type { SupabaseClient } from "@supabase/supabase-js";

export const SYSTEM_ADMIN_EMAILS_TABLE = "system_admin_emails";

export function normalizeAuthEmail(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export function hasAppAdminAccess(
  role: string | null | undefined,
  isSystemAdminEmail: boolean
): boolean {
  return isAdminRole(role) || isSystemAdminEmail;
}

export function hasAppAdminOrSefAccess(
  role: string | null | undefined,
  isSystemAdminEmail: boolean
): boolean {
  return hasAppAdminAccess(role, isSystemAdminEmail) || role === "sef";
}

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    (lower.includes("relation") && lower.includes("not exist")) ||
    lower.includes("could not find the table")
  );
}

export type SystemAdminEmailCheckResult = {
  isSystemAdmin: boolean;
  error: string | null;
};

export async function checkSystemAdminEmail(
  supabase: SupabaseClient,
  email?: string | null
): Promise<SystemAdminEmailCheckResult> {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) {
    return { isSystemAdmin: false, error: null };
  }

  const { data, error } = await supabase
    .from(SYSTEM_ADMIN_EMAILS_TABLE)
    .select("email")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        isSystemAdmin: false,
        error:
          "Tabulka system_admin_emails neexistuje. Spusťte migraci v Supabase.",
      };
    }
    return { isSystemAdmin: false, error: error.message };
  }

  return { isSystemAdmin: Boolean(data), error: null };
}

export async function resolveAppAdminAccess(
  supabase: SupabaseClient,
  userId: string,
  authEmail?: string | null
): Promise<boolean> {
  const email = normalizeAuthEmail(authEmail);
  if (!email) {
    return false;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (isAdminRole(profile?.role)) {
    return true;
  }

  const systemCheck = await checkSystemAdminEmail(supabase, email);
  if (systemCheck.error) {
    return false;
  }

  return hasAppAdminAccess(profile?.role, systemCheck.isSystemAdmin);
}
