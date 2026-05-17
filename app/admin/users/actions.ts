"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = {
  ok: boolean;
  error?: string;
};

const allowedRoles = ["admin", "sef", "skladnik", "zamestnanec"];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function splitEmployeeName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    jmeno: parts[0] ?? "",
    prijmeni: parts.slice(1).join(" "),
  };
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

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, email, role, jmeno, prijmeni, hodinovy_naklad_akce, bank_account_number, bank_code, iban, aktivni")
    .order("aktivni", { ascending: false })
    .order("prijmeni", { ascending: true })
    .order("jmeno", { ascending: true });

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
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return { ok: false, error: authError };

    const normalizedRole = String(newRole).trim().toLowerCase();

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

    revalidatePath("/admin");
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateUserActionCost(
  targetUserId: string,
  hourlyCost: string
): Promise<ActionResult> {
  try {
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return { ok: false, error: authError };

    const normalized = hourlyCost.trim().replace(",", ".");
    const parsed = normalized === "" ? 0 : Number(normalized);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, error: "Hodinový náklad musí být číslo 0 nebo vyšší." };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ hodinovy_naklad_akce: parsed })
      .eq("user_id", targetUserId);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin");
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateUserBankDetails(
  targetUserId: string,
  field: "bank_account_number" | "bank_code" | "iban",
  value: string
): Promise<ActionResult> {
  try {
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return { ok: false, error: authError };

    const normalized = value.trim();
    const patch: Record<string, string | null> = {};

    if (field === "bank_account_number") patch.bank_account_number = normalized || null;
    else if (field === "bank_code") patch.bank_code = normalized || null;
    else if (field === "iban") patch.iban = normalized.replace(/\s+/g, "").toUpperCase() || null;
    else return { ok: false, error: "Neplatné bankovní pole." };

    const { error } = await supabase.from("profiles").update(patch).eq("user_id", targetUserId);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin");
    revalidatePath("/admin/proplaceni");
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateUserName(
  targetUserId: string,
  fullName: string
): Promise<ActionResult> {
  try {
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return { ok: false, error: authError };

    const trimmed = fullName.trim();
    if (!trimmed) {
      return { ok: false, error: "Jméno je povinné." };
    }

    const { jmeno, prijmeni } = splitEmployeeName(trimmed);
    const { error } = await supabase
      .from("profiles")
      .update({ jmeno, prijmeni })
      .eq("user_id", targetUserId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

async function isEmailUsedByOtherActiveProfile(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  excludeUserId: string
) {
  const { data, error } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .eq("aktivni", true)
    .neq("user_id", excludeUserId)
    .limit(1);

  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function updateUserEmail(
  targetUserId: string,
  nextEmailRaw: string
): Promise<ActionResult> {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return { ok: false, error: authError };

    const nextEmail = nextEmailRaw.trim().toLowerCase();
    if (!nextEmail) return { ok: false, error: "Email je povinný." };

    const admin = createAdminClient();
    const { data: currentProfile, error: currentError } = await admin
      .from("profiles")
      .select("email")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (currentError) return { ok: false, error: currentError.message };

    const oldEmail = String(currentProfile?.email ?? "").trim().toLowerCase();
    if (oldEmail === nextEmail) return { ok: true };

    const authUpdate = await admin.auth.admin.updateUserById(targetUserId, {
      email: nextEmail,
      email_confirm: true,
    });

    if (authUpdate.error) {
      return { ok: false, error: `Email v auth se nepodařilo změnit: ${authUpdate.error.message}` };
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({ email: nextEmail })
      .eq("user_id", targetUserId);

    if (profileError) {
      if (oldEmail) {
        await admin.auth.admin.updateUserById(targetUserId, { email: oldEmail, email_confirm: true });
      }
      return { ok: false, error: profileError.message };
    }

    const { error: whitelistAddError } = await admin
      .from("povolene_emaily")
      .upsert({ email: nextEmail });

    if (whitelistAddError) {
      await admin.from("profiles").update({ email: oldEmail || null }).eq("user_id", targetUserId);
      if (oldEmail) {
        await admin.auth.admin.updateUserById(targetUserId, { email: oldEmail, email_confirm: true });
      }
      return { ok: false, error: whitelistAddError.message };
    }

    if (oldEmail && !(await isEmailUsedByOtherActiveProfile(admin, oldEmail, targetUserId))) {
      await admin.from("povolene_emaily").delete().eq("email", oldEmail);
    }

    revalidatePath("/admin");
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deactivateEmployee(targetUserId: string): Promise<ActionResult> {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return { ok: false, error: authError };

    const admin = createAdminClient();
    const { data: currentProfile, error: currentError } = await admin
      .from("profiles")
      .select("email")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (currentError) return { ok: false, error: currentError.message };

    const email = String(currentProfile?.email ?? "").trim().toLowerCase();
    const { error: profileError } = await admin
      .from("profiles")
      .update({ aktivni: false })
      .eq("user_id", targetUserId);

    if (profileError) return { ok: false, error: profileError.message };

    if (email && !(await isEmailUsedByOtherActiveProfile(admin, email, targetUserId))) {
      const { error: whitelistError } = await admin.from("povolene_emaily").delete().eq("email", email);
      if (whitelistError) return { ok: false, error: whitelistError.message };
    }

    revalidatePath("/admin");
    revalidatePath("/zakazky");
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function createEmployee(formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return { ok: false, error: authError };

    const fullName = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "").trim().toLowerCase();
    const hourlyCostRaw = String(formData.get("hodinovy_naklad_akce") ?? "").trim().replace(",", ".");
    const hourlyCost = hourlyCostRaw === "" ? 0 : Number(hourlyCostRaw);

    if (!fullName) return { ok: false, error: "Jméno je povinné." };
    if (!email) return { ok: false, error: "Email je povinný." };
    if (!allowedRoles.includes(role)) return { ok: false, error: "Neplatná role." };
    if (!Number.isFinite(hourlyCost) || hourlyCost < 0) {
      return { ok: false, error: "Hodinový náklad musí být číslo 0 nebo vyšší." };
    }

    const { error: whitelistError } = await supabase.rpc("add_whitelist_email", {
      email_to_add: email,
    });

    if (whitelistError) return { ok: false, error: whitelistError.message };

    const admin = createAdminClient();
    const password = crypto.randomUUID() + crypto.randomUUID();
    const createResult = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: fullName },
    });

    if (createResult.error) {
      return {
        ok: false,
        error:
          "Email byl povolen, ale auth uživatele se nepodařilo vytvořit. Pokud už existuje, uprav ho v seznamu zaměstnanců.",
      };
    }

    const { jmeno, prijmeni } = splitEmployeeName(fullName);
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({
        user_id: createResult.data.user.id,
        email,
        role,
        jmeno,
        prijmeni,
        hodinovy_naklad_akce: hourlyCost,
        aktivni: true,
      });

    if (profileError) return { ok: false, error: profileError.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
