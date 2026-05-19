"use server";

import { createClient } from "@/lib/supabase/server";
import {
  isEmployeeLoginAllowed,
  loadEmployeeProfile,
} from "@/lib/auth/employee-access";

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

/** E-maily se stejným zdrojem pravdy jako přihlášení: tabulka profiles (zaměstnanci). */
export async function getWhitelist() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("email, role, aktivni")
    .not("email", "is", null)
    .order("email", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    email: String(row.email ?? "").trim().toLowerCase(),
    role: row.role,
    aktivni: row.aktivni,
  }));
}

export async function addWhitelistEmail(_email: string): Promise<ActionResult> {
  try {
    const { error: authError } = await requireAdmin();

    if (authError) {
      return { ok: false, error: authError };
    }

    return {
      ok: false,
      error:
        "Přístup se řídí přes zaměstnance v profiles. Nového člověka přidejte v sekci Zaměstnanci (vytvoří se auth účet i profil).",
    };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteWhitelistEmail(_email: string): Promise<ActionResult> {
  try {
    const { error: authError } = await requireAdmin();

    if (authError) {
      return { ok: false, error: authError };
    }

    return {
      ok: false,
      error:
        "Odebrání přístupu: použijte deaktivaci zaměstnance v sekci Zaměstnanci (sloupec aktivni / akce deaktivace).",
    };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
