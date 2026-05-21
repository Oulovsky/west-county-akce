"use server";

import { revalidatePath } from "next/cache";
import { requireAppAdmin } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = {
  ok: boolean;
  error?: string;
  warning?: string;
  hodinovy_naklad_akce?: number;
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
  const result = await requireAppAdmin();
  if (!result.ok) {
    return { supabase: result.supabase, error: result.error };
  }
  return { supabase: result.supabase, error: null };
}

export async function getUsers() {
  const result = await requireAppAdmin();
  if (!result.ok) {
    throw new Error(result.error);
  }

  const { supabase } = result;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, email, role, jmeno, prijmeni, hodinovy_naklad_akce, bank_account_number, bank_code, iban, aktivni")
    .order("aktivni", { ascending: false })
    .order("prijmeni", { ascending: true })
    .order("jmeno", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const users = data ?? [];
  const userIds = users.map((row) => row.user_id).filter(Boolean);

  if (userIds.length === 0) return users;

  const { data: vehicles, error: vehiclesError } = await supabase
    .from("vozidla")
    .select("id, nazev, spz, vlastnik_user_id, kapacita_osob, poznamka, aktivni")
    .eq("typ", "soukrome")
    .eq("aktivni", true)
    .in("vlastnik_user_id", userIds);

  if (vehiclesError) {
    console.warn("Soukromá vozidla se nepodařilo načíst. Spusťte npx supabase db push.", vehiclesError.message);
    return users;
  }

  const vehicleByOwner = new Map((vehicles ?? []).map((vehicle) => [vehicle.vlastnik_user_id, vehicle]));
  return users.map((row) => ({
    ...row,
    private_vehicle: vehicleByOwner.get(row.user_id) ?? null,
  }));
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
    const { error: authError } = await requireAdmin();
    if (authError) return { ok: false, error: authError };

    const normalized = hourlyCost.trim().replace(",", ".");
    const parsed = normalized === "" ? 0 : Number(normalized);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, error: "Hodinový náklad musí být číslo 0 nebo vyšší." };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({ hodinovy_naklad_akce: parsed })
      .eq("user_id", targetUserId)
      .select("hodinovy_naklad_akce")
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data) {
      return {
        ok: false,
        error: "Profil zaměstnance nebyl nalezen nebo se hodnota neuložila.",
      };
    }

    const savedValue = Number(data.hodinovy_naklad_akce ?? parsed);
    if (!Number.isFinite(savedValue)) {
      return { ok: false, error: "Uložená hodinová mzda není platné číslo." };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/proplaceni");
    return { ok: true, hodinovy_naklad_akce: savedValue };
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

export async function updateUserPrivateVehicle(
  targetUserId: string,
  input: {
    nazev?: string;
    spz?: string;
    kapacita_osob?: string;
    poznamka?: string;
  }
): Promise<ActionResult> {
  try {
    const { supabase, error: authError } = await requireAdmin();
    if (authError) return { ok: false, error: authError };

    const nazev = String(input.nazev ?? "").trim();
    const spz = String(input.spz ?? "").trim();
    const poznamka = String(input.poznamka ?? "").trim();
    const capacityRaw = String(input.kapacita_osob ?? "").trim();
    const capacity = capacityRaw === "" ? null : Number(capacityRaw);

    if (capacity !== null && (!Number.isFinite(capacity) || capacity < 0)) {
      return { ok: false, error: "Kapacita osob musí být nezáporné číslo." };
    }

    const allEmpty = !nazev && !spz && !poznamka && capacity === null;
    const { data: existing, error: existingError } = await supabase
      .from("vozidla")
      .select("id")
      .eq("typ", "soukrome")
      .eq("vlastnik_user_id", targetUserId)
      .eq("aktivni", true)
      .limit(1)
      .maybeSingle();

    if (existingError) return { ok: false, error: existingError.message };

    if (allEmpty) {
      if (existing?.id) {
        const { error } = await supabase
          .from("vozidla")
          .update({ aktivni: false, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) return { ok: false, error: error.message };
      }
      revalidatePath("/admin");
      return { ok: true };
    }

    const payload = {
      nazev: nazev || "Soukromé auto",
      spz: spz || null,
      typ: "soukrome",
      vlastnik_user_id: targetUserId,
      aktivni: true,
      kapacita_osob: capacity === null ? null : Math.round(capacity),
      poznamka: poznamka || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = existing?.id
      ? await supabase.from("vozidla").update(payload).eq("id", existing.id)
      : await supabase.from("vozidla").insert(payload);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/admin/vozidla");
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

function isAuthUserNotFound(message: string | undefined): boolean {
  if (!message) return false;
  return message.toLowerCase().includes("user not found");
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const perPage = 200;
  let page = 1;

  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Vyhledání v přihlášení selhalo: ${error.message}`);
    }

    const users = data.users ?? [];
    const match = users.find(
      (user) => user.email?.trim().toLowerCase() === normalized
    );
    if (match?.id) return match.id;

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
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
      .select("user_id, email")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (currentError) {
      return {
        ok: false,
        error: `Profil zaměstnance se nepodařilo načíst: ${currentError.message}`,
      };
    }

    if (!currentProfile) {
      return { ok: false, error: "Profil zaměstnance v databázi nebyl nalezen." };
    }

    const profileUserId = currentProfile.user_id;
    const oldEmail = String(currentProfile.email ?? "").trim().toLowerCase();

    if (oldEmail === nextEmail) return { ok: true };

    const updateAuthEmail = (authUserId: string) =>
      admin.auth.admin.updateUserById(authUserId, {
        email: nextEmail,
        email_confirm: true,
      });

    let authUserId = profileUserId;
    let authUpdate = await updateAuthEmail(authUserId);

    if (authUpdate.error && isAuthUserNotFound(authUpdate.error.message)) {
      if (!oldEmail) {
        return {
          ok: false,
          error:
            "Uživatel v přihlášení (auth) nebyl nalezen podle ID profilu a profil nemá uložený původní email pro dohledání.",
        };
      }

      const authUserIdByEmail = await findAuthUserIdByEmail(admin, oldEmail);

      if (!authUserIdByEmail) {
        const { error: profileOnlyError } = await admin
          .from("profiles")
          .update({ email: nextEmail })
          .eq("user_id", profileUserId);

        if (profileOnlyError) {
          return {
            ok: false,
            error: `Email v profilu se nepodařilo uložit: ${profileOnlyError.message}`,
          };
        }

        revalidatePath("/admin");
        return {
          ok: true,
          warning:
            "Email byl uložen jen v profilu. V přihlášení (auth) nebyl nalezen uživatel s původním emailem — přihlášení může zůstat na starém účtu.",
        };
      }

      authUserId = authUserIdByEmail;
      authUpdate = await updateAuthEmail(authUserId);
    }

    if (authUpdate.error) {
      return {
        ok: false,
        error: `Email v přihlášení se nepodařilo změnit: ${authUpdate.error.message}`,
      };
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({ email: nextEmail })
      .eq("user_id", profileUserId);

    if (profileError) {
      if (oldEmail) {
        await admin.auth.admin.updateUserById(authUserId, {
          email: oldEmail,
          email_confirm: true,
        });
      }
      return {
        ok: false,
        error: `Email v profilu se nepodařilo uložit: ${profileError.message}`,
      };
    }

    revalidatePath("/admin");

    if (authUserId !== profileUserId) {
      return {
        ok: true,
        warning:
          "Email v přihlášení byl změněn pod jiným auth ID než má profil (user_id). Přihlášení a profil mohou být rozdělené — ověřte účet v Supabase Auth.",
      };
    }

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
