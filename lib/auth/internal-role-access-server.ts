import {
  getRolePermissions,
  isReadOnlyInternalRole,
  type RolePermissions,
} from "@/lib/roles";
import { INTERNAL_WRITE_FORBIDDEN_MESSAGE } from "@/lib/auth/internal-role-access";
import type { SupabaseClient } from "@supabase/supabase-js";

export { INTERNAL_WRITE_FORBIDDEN_MESSAGE } from "@/lib/auth/internal-role-access";

export class ForbiddenReadOnlyRoleError extends Error {
  constructor(message = INTERNAL_WRITE_FORBIDDEN_MESSAGE) {
    super(message);
    this.name = "ForbiddenReadOnlyRoleError";
  }
}

export async function loadSessionRolePermissions(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      role: null as string | null,
      perms: getRolePermissions(null),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;

  return {
    user,
    role,
    perms: getRolePermissions(role),
  };
}

export async function assertInternalWriteAccess(supabase: SupabaseClient) {
  const session = await loadSessionRolePermissions(supabase);

  if (isReadOnlyInternalRole(session.role)) {
    throw new ForbiddenReadOnlyRoleError();
  }

  return session;
}

export async function createServerClientWithWriteAccess() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);
  return supabase;
}

export function canEditByPermission(
  perms: RolePermissions,
  permission: keyof Pick<
    RolePermissions,
    "zakazkyEditace" | "technikaEditace" | "skladEditace" | "nakladkaEditace"
  >
) {
  return perms[permission];
}
