"use server";

import { createClient } from "@/lib/supabase/server";

export async function getUsers() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_users");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function addZakazkaClovek(input: {
  zakazka_id: string;
  user_id: string;
  role_na_zakazce: string;
  datum_od: string;
  datum_do: string;
  poznamka?: string | null;
}) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("add_zakazka_clovek", {
    p_zakazka_id: input.zakazka_id,
    p_user_id: input.user_id,
    p_role_na_zakazce: input.role_na_zakazce,
    p_datum_od: input.datum_od,
    p_datum_do: input.datum_do,
    p_poznamka: input.poznamka ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function updateZakazkaClovek(input: {
  id: number;
  role_na_zakazce: string;
  datum_od: string;
  datum_do: string;
  poznamka?: string | null;
}) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("update_zakazka_clovek", {
    p_id: input.id,
    p_role_na_zakazce: input.role_na_zakazce,
    p_datum_od: input.datum_od,
    p_datum_do: input.datum_do,
    p_poznamka: input.poznamka ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function deleteZakazkaClovek(id: number) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_zakazka_clovek", {
    p_id: id,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}