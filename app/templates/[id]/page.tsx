import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

type PageProps = {
  params: Promise<{ id: string }>;
};

type SkladovaPolozka = {
  skladova_polozka_id: string;
  nazev: string;
  jednotka: string | null;
  celkem_k_dispozici: number | string | null;
  aktivni: boolean | null;
};

type TemplateItemRow = {
  id: string;
  template_id: string;
  item_name: string | null;
  quantity: number | string;
  skladova_polozka_id: string | null;
  skladove_polozky:
    | {
        skladova_polozka_id: string;
        nazev: string;
        jednotka: string | null;
        celkem_k_dispozici: number | string | null;
      }
    | {
        skladova_polozka_id: string;
        nazev: string;
        jednotka: string | null;
        celkem_k_dispozici: number | string | null;
      }[]
    | null;
};

function getItemName(row: TemplateItemRow) {
  if (!row.skladove_polozky) return row.item_name || "Neznámá položka";

  if (Array.isArray(row.skladove_polozky)) {
    return row.skladove_polozky[0]?.nazev ?? row.item_name ?? "Neznámá položka";
  }

  return row.skladove_polozky.nazev;
}

function getJednotka(row: TemplateItemRow) {
  if (!row.skladove_polozky) return "ks";

  if (Array.isArray(row.skladove_polozky)) {
    return row.skladove_polozky[0]?.jednotka ?? "ks";
  }

  return row.skladove_polozky.jednotka ?? "ks";
}

function getSkladCelkem(row: TemplateItemRow) {
  if (!row.skladove_polozky) return "—";

  if (Array.isArray(row.skladove_polozky)) {
    return row.skladove_polozky[0]?.celkem_k_dispozici ?? "—";
  }

  return row.skladove_polozky.celkem_k_dispozici ?? "—";
}

export default async function TemplateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  async function renameTemplate(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const templateId = String(formData.get("template_id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();

    if (!templateId) {
      throw new Error("Chybí ID sestavy.");
    }

    if (!name) {
      throw new Error("Název sestavy je povinný.");
    }

    const { error } = await supabase
      .from("templates")
      .update({ name })
      .eq("id", templateId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/templates/${templateId}`);
    revalidatePath("/templates");
  }

  async function addItem(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const templateId = String(formData.get("template_id") ?? "").trim();
    const skladovaPolozkaId = String(formData.get("skladova_polozka_id") ?? "").trim();
    const quantity = Math.max(1, Number(formData.get("quantity") ?? 1) || 1);

    if (!templateId || !skladovaPolozkaId) {
      throw new Error("Chybí povinné údaje.");
    }

    const { data: skladItem, error: skladError } = await supabase
      .from("skladove_polozky")
      .select("skladova_polozka_id, nazev")
      .eq("skladova_polozka_id", skladovaPolozkaId)
      .single();

    if (skladError) {
      throw new Error(skladError.message);
    }

    const { error } = await supabase.from("template_items").insert({
      template_id: templateId,
      skladova_polozka_id: skladItem.skladova_polozka_id,
      item_name: skladItem.nazev,
      quantity,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/templates/${templateId}`);
  }

  async function changeItemQuantity(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const rowId = String(formData.get("row_id") ?? "").trim();
    const direction = String(formData.get("direction") ?? "").trim();
    const templateId = String(formData.get("template_id") ?? "").trim();

    if (!rowId || !templateId) {
      throw new Error("Chybí ID řádku.");
    }

    const { data: row, error: rowError } = await supabase
      .from("template_items")
      .select("id, quantity")
      .eq("id", rowId)
      .single();

    if (rowError) {
      throw new Error(rowError.message);
    }

    const currentQuantity = Number(row.quantity);

    if (direction === "minus") {
      if (currentQuantity <= 1) {
        const { error: deleteError } = await supabase
          .from("template_items")
          .delete()
          .eq("id", rowId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }
      } else {
        const { error: updateError } = await supabase
          .from("template_items")
          .update({ quantity: currentQuantity - 1 })
          .eq("id", rowId);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }
    }

    if (direction === "plus") {
      const { error: updateError } = await supabase
        .from("template_items")
        .update({ quantity: currentQuantity + 1 })
        .eq("id", rowId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    revalidatePath(`/templates/${templateId}`);
  }

  async function removeItem(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const rowId = String(formData.get("row_id") ?? "").trim();
    const templateId = String(formData.get("template_id") ?? "").trim();

    if (!rowId || !templateId) {
      throw new Error("Chybí ID řádku.");
    }

    const { error } = await supabase
      .from("template_items")
      .delete()
      .eq("id", rowId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/templates/${templateId}`);
  }

  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("id, name, created_at")
    .eq("id", id)
    .single();

  if (templateError) {
    return <div>Chyba: {templateError.message}</div>;
  }

  if (!template) {
    return <div>Sestava nenalezena.</div>;
  }

  const { data: skladovePolozkyRaw, error: skladError } = await supabase
    .from("skladove_polozky")
    .select("skladova_polozka_id, nazev, jednotka, celkem_k_dispozici, aktivni")
    .eq("aktivni", true)
    .order("nazev", { ascending: true });

  if (skladError) {
    return <div>Chyba: {skladError.message}</div>;
  }

  const skladovePolozky = (skladovePolozkyRaw ?? []) as SkladovaPolozka[];

  const { data: templateItemsRaw, error: itemsError } = await supabase
    .from("template_items")
    .select(
      "id, template_id, item_name, quantity, skladova_polozka_id, skladove_polozky(skladova_polozka_id, nazev, jednotka, celkem_k_dispozici)"
    )
    .eq("template_id", id);

  if (itemsError) {
    return <div>Chyba: {itemsError.message}</div>;
  }

  const templateItems = ((templateItemsRaw ?? []) as TemplateItemRow[]).sort((a, b) =>
    getItemName(a).localeCompare(getItemName(b), "cs")
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <PageHeader
        title={`Sestava – ${template.name}`}
        description="Skládání sestavy ze skladových položek."
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="default">Sestava</Badge>
            <Link
              href="/templates"
              className="rounded-xl border border-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
            >
              Zpět na seznam
            </Link>
          </div>

          <form action={renameTemplate} className="flex flex-col gap-4 md:flex-row">
            <input type="hidden" name="template_id" value={template.id} />
            <input
              type="text"
              name="name"
              defaultValue={template.name}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
              required
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Uložit název
            </button>
          </form>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="space-y-4">
          <div className="text-lg font-semibold text-white">Přidat položku do sestavy</div>

          <form action={addItem} className="grid gap-4 md:grid-cols-[1fr_160px_auto]">
            <input type="hidden" name="template_id" value={template.id} />

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Skladová položka
              </label>
              <select
                name="skladova_polozka_id"
                defaultValue=""
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
                required
              >
                <option value="" disabled>
                  Vyber položku
                </option>
                {skladovePolozky.map((item) => (
                  <option key={item.skladova_polozka_id} value={item.skladova_polozka_id}>
                    {item.nazev} ({Number(item.celkem_k_dispozici ?? 0)} {item.jednotka ?? "ks"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Počet
              </label>
              <input
                type="number"
                name="quantity"
                min={1}
                step={1}
                defaultValue={1}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
                required
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
              >
                Přidat položku
              </button>
            </div>
          </form>
        </div>
      </Card>

      <div className="grid gap-4">
        {templateItems.length > 0 ? (
          templateItems.map((row) => (
            <Card key={row.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-white">{getItemName(row)}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">
                      V sestavě: {Number(row.quantity)} {getJednotka(row)}
                    </Badge>
                    <Badge variant="warning">
                      Na skladě: {getSkladCelkem(row)} {getJednotka(row)}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={changeItemQuantity}>
                    <input type="hidden" name="template_id" value={template.id} />
                    <input type="hidden" name="row_id" value={row.id} />
                    <input type="hidden" name="direction" value="minus" />
                    <button
                      type="submit"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-2xl font-bold text-white transition hover:bg-slate-700"
                    >
                      -
                    </button>
                  </form>

                  <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2 text-lg font-bold text-white">
                    {Number(row.quantity)}
                  </div>

                  <form action={changeItemQuantity}>
                    <input type="hidden" name="template_id" value={template.id} />
                    <input type="hidden" name="row_id" value={row.id} />
                    <input type="hidden" name="direction" value="plus" />
                    <button
                      type="submit"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600 text-2xl font-bold text-white transition hover:bg-blue-500"
                    >
                      +
                    </button>
                  </form>

                  <form action={removeItem}>
                    <input type="hidden" name="template_id" value={template.id} />
                    <input type="hidden" name="row_id" value={row.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-red-500/40 px-4 py-2 font-semibold text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                    >
                      Odebrat
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <div className="text-sm text-slate-400">
              Sestava zatím neobsahuje žádné skladové položky.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}