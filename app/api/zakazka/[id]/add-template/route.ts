import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function recomputeZakazkaItems(zakazkaId: string) {
  await supabase
    .from("zakazka_items")
    .delete()
    .eq("zakazka_id", zakazkaId);

  const { data: zakazkaTemplates, error: ztError } = await supabase
    .from("zakazka_templates")
    .select("template_id, quantity")
    .eq("zakazka_id", zakazkaId);

  if (ztError) throw ztError;

  const map: Record<string, number> = {};

  for (const zt of zakazkaTemplates || []) {
    const { data: items, error: tiError } = await supabase
      .from("template_items")
      .select("item_name, quantity")
      .eq("template_id", zt.template_id);

    if (tiError) throw tiError;

    for (const item of items || []) {
      const key = item.item_name;
      const qty = Number(item.quantity) * Number(zt.quantity);

      map[key] = (map[key] || 0) + qty;
    }
  }

  const rows = Object.entries(map).map(([item_name, quantity]) => ({
    zakazka_id: zakazkaId,
    item_name,
    quantity,
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("zakazka_items").insert(rows);
    if (error) throw error;
  }
}

export async function POST(req: NextRequest, context: any) {
  try {
    const params = await context.params;
    const zakazkaId = params.id;

    const body = await req.json();
    const { templateId, quantity } = body;

    const { error } = await supabase.from("zakazka_templates").insert({
      zakazka_id: zakazkaId,
      template_id: templateId,
      quantity: quantity || 1,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recomputeZakazkaItems(zakazkaId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Chyba" },
      { status: 500 }
    );
  }
}