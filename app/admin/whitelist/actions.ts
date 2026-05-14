"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  ok: boolean;
  error?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, error: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    return { supabase, error: profileError.message };
  }

  if (!profile || profile.role !== "admin") {
    return { supabase, error: "Forbidden" };
  }

  return { supabase, error: null };
}

export async function getWhitelist() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase.rpc("get_whitelist");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function addWhitelistEmail(email: string): Promise<ActionResult> {
  try {
    const { supabase, error: authError } = await requireAdmin();

    if (authError) {
      return { ok: false, error: authError };
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return { ok: false, error: "Email je povinný" };
    }

    const { error } = await supabase.rpc("add_whitelist_email", {
      email_to_add: normalizedEmail,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteWhitelistEmail(email: string): Promise<ActionResult> {
  try {
    const { supabase, error: authError } = await requireAdmin();

    if (authError) {
      return { ok: false, error: authError };
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return { ok: false, error: "Email je povinný" };
    }

    const { error } = await supabase.rpc("delete_whitelist_email", {
      email_to_delete: normalizedEmail,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
