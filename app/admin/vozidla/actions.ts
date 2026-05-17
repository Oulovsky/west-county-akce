"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function getNullableNumber(formData: FormData, key: string) {
  const value = getString(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Kapacita musí být nezáporné číslo.");
  return Math.round(parsed);
}

async function requireVehicleManager() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Pro správu vozidel musíte být přihlášeni.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile || (profile.role !== "admin" && profile.role !== "sef")) {
    throw new Error("Nemáte oprávnění spravovat vozidla.");
  }

  return { supabase, user };
}

function vehiclePayload(formData: FormData) {
  const nazev = getString(formData, "nazev");
  if (!nazev) throw new Error("Název vozidla je povinný.");

  return {
    nazev,
    spz: getNullableString(formData, "spz"),
    typ: "firemni",
    vlastnik_user_id: null,
    kapacita_osob: getNullableNumber(formData, "kapacita_osob"),
    kapacita_poznamka: getNullableString(formData, "kapacita_poznamka"),
    poznamka: getNullableString(formData, "poznamka"),
    updated_at: new Date().toISOString(),
  };
}

export async function createVehicleAction(formData: FormData) {
  const { supabase } = await requireVehicleManager();
  const { error } = await supabase.from("vozidla").insert(vehiclePayload(formData));
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/vozidla");
}

export async function updateVehicleAction(formData: FormData) {
  const id = getString(formData, "id");
  if (!id) throw new Error("Chybí ID vozidla.");

  const { supabase } = await requireVehicleManager();
  const { error } = await supabase.from("vozidla").update(vehiclePayload(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/vozidla");
}

export async function deactivateVehicleAction(formData: FormData) {
  const id = getString(formData, "id");
  if (!id) throw new Error("Chybí ID vozidla.");

  const { supabase } = await requireVehicleManager();
  const { error } = await supabase
    .from("vozidla")
    .update({ aktivni: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/vozidla");
}
