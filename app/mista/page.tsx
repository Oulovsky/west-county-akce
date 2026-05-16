import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type MistoRow = {
  misto_id: string;
  nazev: string | null;
  adresa_text: string | null;
  aktivni: boolean | null;
  created_at: string | null;
};

type NoteCountRow = {
  misto_id: string;
};

type ZakazkaCountRow = {
  misto_id: string | null;
};

export default async function MistaPage() {
  noStore();
  const supabase = await createClient();

  const { data: mistaRaw, error: mistaError } = await supabase
    .from("mista_konani")
    .select("misto_id, nazev, adresa_text, aktivni, created_at")
    .order("nazev", { ascending: true });

  if (mistaError) {
    return <div>Chyba míst konání: {mistaError.message}</div>;
  }

  const mista = (mistaRaw ?? []) as MistoRow[];
  const mistoIds = mista.map((misto) => misto.misto_id);
  const noteCounts = new Map<string, number>();
  const zakazkaCounts = new Map<string, number>();

  if (mistoIds.length > 0) {
    const [
      { data: notesRaw, error: notesError },
      { data: zakazkyRaw, error: zakazkyError },
    ] = await Promise.all([
      supabase.from("misto_technicke_poznamky").select("misto_id").in("misto_id", mistoIds),
      supabase.from("zakazky").select("misto_id").in("misto_id", mistoIds),
    ]);

    if (notesError) {
      return <div>Chyba počtu poznámek: {notesError.message}</div>;
    }

    if (zakazkyError) {
      return <div>Chyba počtu zakázek: {zakazkyError.message}</div>;
    }

    for (const row of (notesRaw ?? []) as NoteCountRow[]) {
      noteCounts.set(row.misto_id, (noteCounts.get(row.misto_id) ?? 0) + 1);
    }

    for (const row of (zakazkyRaw ?? []) as ZakazkaCountRow[]) {
      if (!row.misto_id) continue;
      zakazkaCounts.set(row.misto_id, (zakazkaCounts.get(row.misto_id) ?? 0) + 1);
    }
  }

  return (
    <main className="w-full text-white">
      <PageHeader
        title="Místa konání"
        description="Interní přehled uložených míst a technického know-how."
      />

      <div className="mt-6 grid gap-3">
        {mista.length === 0 ? (
          <Card>
            <div className="text-sm text-slate-400">Zatím nejsou uložená žádná místa konání.</div>
          </Card>
        ) : (
          mista.map((misto) => (
            <Link
              key={misto.misto_id}
              href={`/mista/${misto.misto_id}`}
              className="block rounded-2xl border border-slate-800 bg-[#0b1324] p-5 transition hover:border-blue-500/50 hover:bg-slate-900"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xl font-black text-white">{misto.nazev ?? "Místo konání"}</div>
                  {misto.adresa_text ? (
                    <div className="mt-1 text-sm text-slate-400">{misto.adresa_text}</div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-lg border border-blue-500/30 bg-blue-950/30 px-3 py-1 text-blue-100">
                    {zakazkaCounts.get(misto.misto_id) ?? 0} zakázek
                  </span>
                  <span className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-1 text-amber-100">
                    {noteCounts.get(misto.misto_id) ?? 0} poznámek
                  </span>
                  {!misto.aktivni ? (
                    <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
                      Neaktivní
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
