import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type TemplateRow = {
  id: string;
  name: string;
};

type ZakazkaTemplateRow = {
  id: string;
  template_id: string;
  quantity: number | string;
  templates:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type TechnikaSummaryRow = {
  skladova_polozka_id: string;
  nazev: string;
  mnozstvi: number | string;
};

type ZakazkaTemplatesCardProps = {
  templates: TemplateRow[];
  zakazkaTemplates: ZakazkaTemplateRow[];
  technikaSummary: TechnikaSummaryRow[];
  addTemplateAction: (formData: FormData) => Promise<void>;
  changeTemplateQuantityAction: (formData: FormData) => Promise<void>;
  removeTemplateAction: (formData: FormData) => Promise<void>;
};

function getTemplateName(row: ZakazkaTemplateRow) {
  if (!row.templates) return "Neznámá sestava";

  if (Array.isArray(row.templates)) {
    return row.templates[0]?.name ?? "Neznámá sestava";
  }

  return row.templates.name;
}

export function ZakazkaTemplatesCard({
  templates,
  zakazkaTemplates,
  technikaSummary,
  addTemplateAction,
  changeTemplateQuantityAction,
  removeTemplateAction,
}: ZakazkaTemplatesCardProps) {
  return (
    <Card className="mt-6">
      <div className="space-y-6">
        <div>
          <div className="text-lg font-semibold text-white">Sestavy</div>
          <div className="mt-1 text-sm text-slate-400">
            Vyber sestavu, zadej počet a přidej ji na zakázku.
          </div>
        </div>

        <form action={addTemplateAction} className="grid gap-4 md:grid-cols-[1fr_160px_auto]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Sestava</label>
            <select
              name="templateId"
              defaultValue=""
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
              required
            >
              <option value="" disabled>
                Vyber sestavu
              </option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Počet</label>
            <input
              type="number"
              name="quantity"
              min={1}
              step={1}
              defaultValue={1}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Přidat sestavu
            </button>
          </div>
        </form>

        <div>
          <div className="mb-3 text-sm font-medium text-slate-300">Přidané sestavy na zakázce</div>

          {zakazkaTemplates.length ? (
            <div className="space-y-3">
              {zakazkaTemplates.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3"
                >
                  <div className="text-slate-100">{getTemplateName(row)}</div>

                  <div className="flex items-center gap-2">
                    <form action={changeTemplateQuantityAction}>
                      <input type="hidden" name="rowId" value={row.id} />
                      <input type="hidden" name="direction" value="minus" />
                      <button
                        type="submit"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 text-base font-semibold text-slate-200 transition hover:bg-slate-800"
                        aria-label="Snížit počet"
                      >
                        -
                      </button>
                    </form>

                    <Badge variant="default">{Number(row.quantity)}×</Badge>

                    <form action={changeTemplateQuantityAction}>
                      <input type="hidden" name="rowId" value={row.id} />
                      <input type="hidden" name="direction" value="plus" />
                      <button
                        type="submit"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 text-base font-semibold text-slate-200 transition hover:bg-slate-800"
                        aria-label="Zvýšit počet"
                      >
                        +
                      </button>
                    </form>

                    <form action={removeTemplateAction}>
                      <input type="hidden" name="rowId" value={row.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                      >
                        Odebrat
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-400">
              Na zakázce zatím není přidaná žádná sestava.
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 text-sm font-medium text-slate-300">Výsledná technika ze sestav</div>

          <div className="space-y-3">
            {technikaSummary.length > 0 ? (
              technikaSummary.map((item) => (
                <div
                  key={item.skladova_polozka_id}
                  className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3"
                >
                  <div className="text-slate-100">{item.nazev}</div>
                  <Badge variant="default">{Number(item.mnozstvi)} ks</Badge>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-400">
                Na zakázce zatím nejsou žádné položky ze sestav.
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}