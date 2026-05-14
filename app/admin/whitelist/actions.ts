"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  ok: boolean;
  error?: string;
};

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
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Unknown error" };
  }
}

export async function deleteWhitelistEmail(email: string): Promise<ActionResult> {
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
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Unknown error" };
  }
}