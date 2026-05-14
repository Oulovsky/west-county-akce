import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ZakazkaSubnav } from "@/components/zakazky/zakazka-subnav";

type PageProps = {
  params: Promise<{ id: string }>;
};

type PoskozeniRow = {
  poskozeni_id: string;
  skladova_polozka_id: string;
  pocet_kusu: number | string | null;
  popis: string | null;
  typ_poskozeni: string | null;
  blokuje_pouziti: boolean | null;
  datum_nahlaseni: string | null;
  sklad:
    | {
        nazev: string | null;
        jednotka: string | null;
      }
    | {
        nazev: string | null;
        jednotka: string | null;
      }[]
    | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getSkladInfo(
  sklad: PoskozeniRow["sklad"]
): { nazev: string; jednotka: string } {
  if (Array.isArray(sklad)) {
    return {
      nazev: sklad[0]?.nazev ?? "Položka",
      jednotka: sklad[0]?.jednotka ?? "ks",
    };
  }

  return {
    nazev: sklad?.nazev ?? "Položka",
    jednotka: sklad?.jednotka ?? "ks",
  };
}

export default async function ZakazkaPoskozeniPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: zakazka, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev")
    .eq("zakazka_id", id)
    .single();

  if (zakazkaError) {
    return <div>Chyba: {zakazkaError.message}</div>;
  }

  if (!zakazka) {
    return <div>Zakázka nenalezena</div>;
  }

  const { data: rowsRaw, error: rowsError } = await supabase
    .from("hlaseni_poskozeni")
    .select(
      `
        poskozeni_id,
        skladova_polozka_id,
        pocet_kusu,
        popis,
        typ_poskozeni,
        blokuje_pouziti,
        datum_nahlaseni,
        sklad:skladove_polozky(nazev, jednotka)
      `
    )
    .eq("zakazka_id", id)
    .order("datum_nahlaseni", { ascending: false });

  if (rowsError) {
    return <div>Chyba: {rowsError.message}</div>;
  }

  const rows = (rowsRaw ?? []) as PoskozeniRow[];
  const blokovaneKusy = rows.reduce((sum, row) => {
    if (!row.blokuje_pouziti) return sum;
    return sum + (Number(row.pocet_kusu ?? 0) || 0);
  }, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <Card className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">
              Poškození na zakázce
            </div>
            <div className="text-slate-300">
              {zakazka.cislo_zakazky} – {zakazka.nazev}
            </div>
            <div className="text-sm text-slate-400">
              Přehled nahlášených poškození pouze pro tuto zakázku.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="default">{rows.length} záznamů</Badge>
            <Badge variant={blokovaneKusy > 0 ? "warning" : "success"}>
              Blokované kusy: {blokovaneKusy}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <ZakazkaSubnav zakazkaId={id} active="detail" showBackLink />
      </div>

      <Card className="mt-6">
        <div className="space-y-4">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
              Na této zakázce není žádné poškození.
            </div>
          ) : (
            rows.map((row) => {
              const sklad = getSkladInfo(row.sklad);

              return (
                <div
                  key={row.poskozeni_id}
                  className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-base font-semibold text-white">
                        {sklad.nazev}
                      </div>
                      <div className="text-sm text-slate-400">
                        Nahlášeno: {formatDateTime(row.datum_nahlaseni)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">
                        {Number(row.pocet_kusu ?? 0)} {sklad.jednotka}
                      </Badge>
                      <Badge variant="default">
                        {row.typ_poskozeni?.trim() || "bez typu"}
                      </Badge>
                      <Badge
                        variant={row.blokuje_pouziti ? "warning" : "success"}
                      >
                        {row.blokuje_pouziti ? "Blokuje použití" : "Použitelné"}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
                    {row.popis?.trim() || "Bez popisu"}
                  </div>

                  <div className="mt-3">
                    <Link
                      href={`/sklad/poskozeni`}
                      className="text-sm font-medium text-blue-300 transition hover:text-blue-200"
                    >
                      Otevřít přehled všech poškození
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}