import { createClient } from "@/lib/supabase/server";

export function combineDateAndTime(dateValue?: string | null, timeValue?: string | null) {
  if (!dateValue || !timeValue) return null;
  return `${dateValue}T${timeValue}:00`;
}

export async function recomputeZakazkaTechnikaFromTemplates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  zakazkaId: string
) {
  void supabase;
  void zakazkaId;

  // Legacy templates jsou odpojené od aktivního zakázkového workflow.
  // Funkce zůstává kvůli starým importům, ale nesmí mazat plán vytvořený
  // ze skladových setupů a ručních položek v technika_na_zakazce.
}