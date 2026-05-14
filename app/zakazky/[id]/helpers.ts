import { createClient } from "@/lib/supabase/server";

export function combineDateAndTime(dateValue?: string | null, timeValue?: string | null) {
  if (!dateValue || !timeValue) return null;
  return `${dateValue}T${timeValue}:00`;
}

export async function recomputeZakazkaTechnikaFromTemplates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  zakazkaId: string
) {
  const { error: deleteError } = await supabase
    .from("technika_na_zakazce")
    .delete()
    .eq("zakazka_id", zakazkaId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { data: zakazkaTemplates, error: zakazkaTemplatesError } = await supabase
    .from("zakazka_templates")
    .select("template_id, quantity")
    .eq("zakazka_id", zakazkaId);

  if (zakazkaTemplatesError) {
    throw new Error(zakazkaTemplatesError.message);
  }

  const map: Record<string, number> = {};

  for (const row of zakazkaTemplates ?? []) {
    const { data: templateItems, error: templateItemsError } = await supabase
      .from("template_items")
      .select("skladova_polozka_id, quantity")
      .eq("template_id", row.template_id)
      .not("skladova_polozka_id", "is", null);

    if (templateItemsError) {
      throw new Error(templateItemsError.message);
    }

    for (const item of templateItems ?? []) {
      const skladovaPolozkaId = String(item.skladova_polozka_id ?? "").trim();
      if (!skladovaPolozkaId) continue;

      const qty = Number(item.quantity) * Number(row.quantity);
      map[skladovaPolozkaId] = (map[skladovaPolozkaId] || 0) + qty;
    }
  }

  const rows = Object.entries(map).map(([skladova_polozka_id, mnozstvi]) => ({
    zakazka_id: zakazkaId,
    skladova_polozka_id,
    mnozstvi,
  }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("technika_na_zakazce")
      .insert(rows);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}