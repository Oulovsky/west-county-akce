import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { formatDateTime, formatSkladKusStav, getSkladKusDisplayLabel } from "@/lib/sklad/helpers";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{ stav?: string }>;
};

type KusRow = {
  kus_id: string;
  skladova_polozka_id: string;
  poradove_cislo: number;
  evidencni_cislo: string | null;
  stav: string | null;
  aktivni: boolean | null;
  servisni_poznamka: string | null;
  servisni_stav_changed_at: string | null;
  skladove_polozky:
    | { nazev: string | null; pozice: number | string | null }
    | { nazev: string | null; pozice: number | string | null }[]
    | null;
};

type DamageRow = {
  kus_id: string | null;
  popis: string | null;
  blokuje_pouziti: boolean | null;
  datum_nahlaseni: string | null;
};

type FilterMode = "vse" | "poskozeno" | "blokovano" | "v_oprave" | "ceka_na_kontrolu";

function normalizeFilter(value?: string | null): FilterMode {
  if (value === "poskozeno" || value === "blokovano" || value === "v_oprave" || value === "ceka_na_kontrolu") {
    return value;
  }
  return "vse";
}

function getItem(row: KusRow) {
  return Array.isArray(row.skladove_polozky) ? row.skladove_polozky[0] : row.skladove_polozky;
}

function getProblemLabel(row: KusRow, damage?: DamageRow | null) {
  if (row.aktivni === false || row.stav === "vyrazeno" || row.stav === "odpis") return "Vyřazeno";
  if (row.stav === "v_oprave") return "V opravě";
  if (row.stav === "ceka_na_kontrolu") return "Čeká na kontrolu";
  if (row.stav === "blokovano" || damage?.blokuje_pouziti) return "Blokováno";
  return "Poškozeno";
}

function getBadgeVariant(row: KusRow, damage?: DamageRow | null) {
  const label = getProblemLabel(row, damage);
  if (label === "Poškozeno" || label === "Čeká na kontrolu") return "warning" as const;
  return "danger" as const;
}

export default async function SkladServisPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const filter = normalizeFilter(resolvedSearchParams?.stav);
  const supabase = await createClient();

  const problemStates = ["poskozeno", "blokovano", "v_oprave", "ceka_na_kontrolu", "odpis", "vyrazeno"];
  let kusQuery = supabase
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id, skladova_polozka_id, poradove_cislo, evidencni_cislo, stav, aktivni, servisni_poznamka, servisni_stav_changed_at, skladove_polozky(nazev, pozice)")
    .order("servisni_stav_changed_at", { ascending: false, nullsFirst: false })
    .order("poradove_cislo", { ascending: true });

  if (filter === "vse") {
    kusQuery = kusQuery.in("stav", problemStates);
  } else {
    kusQuery = kusQuery.eq("stav", filter);
  }

  const { data: kusyRaw, error: kusyError } = await kusQuery;
  if (kusyError) {
    return <div className="p-6 text-red-300">{kusyError.message}</div>;
  }

  const kusy = (kusyRaw ?? []) as KusRow[];
  const kusIds = kusy.map((row) => row.kus_id);
  const damageByKus = new Map<string, DamageRow>();

  if (kusIds.length > 0) {
    const { data: damageRaw, error: damageError } = await supabase
      .from(SKLAD_TABLE.hlaseniPoskozeni)
      .select("kus_id, popis, blokuje_pouziti, datum_nahlaseni")
      .in("kus_id", kusIds)
      .is("datum_uzavreni", null)
      .order("datum_nahlaseni", { ascending: false });

    if (damageError) {
      return <div className="p-6 text-red-300">{damageError.message}</div>;
    }

    for (const row of (damageRaw ?? []) as DamageRow[]) {
      if (row.kus_id && !damageByKus.has(row.kus_id)) damageByKus.set(row.kus_id, row);
    }
  }

  const filters: Array<{ key: FilterMode; label: string; href: string }> = [
    { key: "vse", label: "Vše", href: "/sklad/servis" },
    { key: "poskozeno", label: "Poškozené", href: "/sklad/servis?stav=poskozeno" },
    { key: "blokovano", label: "Blokované", href: "/sklad/servis?stav=blokovano" },
    { key: "v_oprave", label: "V opravě", href: "/sklad/servis?stav=v_oprave" },
    { key: "ceka_na_kontrolu", label: "Čeká na kontrolu", href: "/sklad/servis?stav=ceka_na_kontrolu" },
  ];

  return (
    <div className="page-shell w-full space-y-5 text-slate-200">
      <div>
        <Link href="/sklad/sprava" className="text-sm font-semibold text-blue-200 hover:text-blue-100">
          ← Zpět do správy skladu
        </Link>
        <h1 className="mt-3 text-3xl font-black text-white">Servis a blokace kusů</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Přehled konkrétních kusů, které nejsou běžně použitelné pro nakládku.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={[
              "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition",
              filter === item.key
                ? "border-blue-400 bg-blue-600 text-white"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {kusy.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">Žádné problémové kusy pro tento filtr.</div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {kusy.map((kus) => {
            const item = getItem(kus);
            const damage = damageByKus.get(kus.kus_id) ?? null;
            const label = getSkladKusDisplayLabel(item?.nazev || "Položka", kus);
            return (
              <Card key={kus.kus_id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-black text-white">{label}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {item?.nazev || "Položka"} · pozice {item?.pozice ?? "—"}
                    </div>
                  </div>
                  <Badge variant={getBadgeVariant(kus, damage)}>{getProblemLabel(kus, damage)}</Badge>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Stav kusu</div>
                    <div className="font-bold text-slate-100">{formatSkladKusStav(kus.stav)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Změněno</div>
                    <div className="font-bold text-slate-100">{formatDateTime(kus.servisni_stav_changed_at)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Otevřené poškození</div>
                    <div className="font-bold text-slate-100">{damage?.popis || "—"}</div>
                  </div>
                </div>
                {kus.servisni_poznamka ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-300">
                    {kus.servisni_poznamka}
                  </div>
                ) : null}
                <Link
                  href={`/sklad/kus/${kus.kus_id}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-3 text-sm font-bold text-blue-100 transition hover:bg-blue-600/30"
                >
                  Otevřít kus
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
