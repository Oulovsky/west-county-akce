"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  ok: boolean;
  error?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function getUsers() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden");
  }

  const { data, error } = await supabase.rpc("get_users");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function updateUserRole(
  targetUserId: string,
  newRole: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Unauthorized" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      return { ok: false, error: profileError.message };
    }

    if (!profile || profile.role !== "admin") {
      return { ok: false, error: "Forbidden" };
    }

    const normalizedRole = String(newRole).trim().toLowerCase();

    const allowedRoles = ["admin", "sef", "skladnik", "zamestnanec"];

    if (!allowedRoles.includes(normalizedRole)) {
      return { ok: false, error: "Neplatná role" };
    }

    const { error } = await supabase.rpc("update_user_role", {
      target_user_id: targetUserId,
      new_role: normalizedRole,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
