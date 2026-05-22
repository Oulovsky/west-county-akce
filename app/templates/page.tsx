import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

type TemplateRow = {
  id: string;
  name: string;
  created_at: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return (
    new Intl.DateTimeFormat("cs-CZ").format(d) +
    " " +
    d.toTimeString().slice(0, 5)
  );
}

export default async function TemplatesPage() {
  const supabase = await createClient();

  async function createTemplate(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const name = String(formData.get("name") ?? "").trim();

    if (!name) {
      throw new Error("Název sestavy je povinný.");
    }

    const { error } = await supabase.from("templates").insert({
      name,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/templates");
  }

  const { data, error } = await supabase
    .from("templates")
    .select("id, name, created_at")
    .order("name", { ascending: true });

  if (error) {
    return <div>Chyba: {error.message}</div>;
  }

  const templates = (data ?? []) as TemplateRow[];

  return (
    <div className="page-shell w-full">
      <PageHeader
        title="Sestavy"
        description="Legacy správa starých sestav. Nový zakázkový workflow používá Setupy skladu."
      />

      <Card className="mb-6 border-amber-900/60 bg-amber-950/30">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="warning">Legacy</Badge>
          <div className="text-sm text-amber-100">
            Tento starý systém templates už není aktivní zdroj plánu zakázky. Pro nové plánování používej `/sklad/setupy`.
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <form action={createTemplate} className="flex flex-col gap-4 md:flex-row">
          <input
            type="text"
            name="name"
            placeholder="Např. Malý zvuk"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
            required
          />

          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
          >
            Vytvořit sestavu
          </button>
        </form>
      </Card>

      <div className="grid gap-4">
        {templates.length > 0 ? (
          templates.map((template) => (
            <Card key={template.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-white">{template.name}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">Sestava</Badge>
                    <Badge variant="warning">
                      Vytvořeno: {formatDateTime(template.created_at)}
                    </Badge>
                  </div>
                </div>

                <Link
                  href={`/templates/${template.id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
                >
                  Otevřít
                </Link>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <div className="text-sm text-slate-400">
              Zatím neexistuje žádná sestava.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}