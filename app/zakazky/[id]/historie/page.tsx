import { unstable_noStore as noStore } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getRolePermissions } from "@/lib/roles";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ZakazkaSubnav } from "@/components/zakazky/zakazka-subnav";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Zakazka = {
  zakazka_id: string;
  cislo_zakazky: string;
  nazev: string;
};

type HistorieZmenyRow = {
  historie_id: string;
  zakazka_id: string | null;
  skladova_polozka_id: string | null;
  typ: string | null;
  stara_hodnota: number | null;
  nova_hodnota: number | null;
  created_at: string | null;
};

type HistorieZmeny = HistorieZmenyRow & {
  nazev_polozky: string | null;
};

type SkladKusHistorieRow = {
  historie_id: string;
  kus_id: string;
  zakazka_id: string | null;
  typ_akce: string | null;
  poznamka: string | null;
  created_at: string | null;
};

type SkladKusRow = {
  kus_id: string;
  skladova_polozka_id: string;
  poradove_cislo: number | string | null;
  evidencni_cislo: string | null;
};

type SkladovaPolozka = {
  skladova_polozka_id: string;
  nazev: string;
};

type SouhrnRadek = {
  klic: string;
  zdroj: "legacy" | "scan";
  oblast: "technika" | "nakladka" | "jine";
  skladova_polozka_id: string | null;
  nazev_polozky: string | null;
  udalost: string;
  stav_od: number;
  stav_do: number;
  created_at_od: string | null;
  created_at_do: string | null;
  pocet_zmen: number;
  evidencni_cislo: string | null;
  poznamka: string | null;
};

function formatDatumCas(value: string | null) {
  if (!value) return "—";

  const d = new Date(value);

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function getOblast(typ: string | null): "technika" | "nakladka" | "jine" {
  if (!typ) return "jine";
  if (typ.startsWith("technika_")) return "technika";
  if (typ.startsWith("nakladka_")) return "nakladka";
  return "jine";
}

function formatOblast(oblast: "technika" | "nakladka" | "jine") {
  switch (oblast) {
    case "technika":
      return "Technika";
    case "nakladka":
      return "Nakládka";
    default:
      return "Jiné";
  }
}

function getZmena(stavOd: number, stavDo: number) {
  const diff = stavDo - stavOd;
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return "0";
}

function formatScanAuditUdalost(typAkce: string | null, poznamka: string | null) {
  const note = poznamka?.toLowerCase() ?? "";

  if (note.includes("náhrada") || note.includes("nahrada")) return "Použita náhrada";
  if (note.includes("rezerva")) return "Naložena rezerva";

  switch (typAkce) {
    case "nalozeno":
      return "Naložen kus";
    case "vraceno":
      return "Vrácen kus";
    case "poskozeno":
      return "Kus označen jako poškozený";
    case "blokovano":
      return "Kus zablokován";
    default:
      return typAkce?.trim() || "Audit kusu";
  }
}

function seradHistoriiVzestupne(a: HistorieZmeny, b: HistorieZmeny) {
  const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

  if (aTime !== bTime) return aTime - bTime;

  return a.historie_id.localeCompare(b.historie_id);
}

function vytvorSouhrn(historie: HistorieZmeny[]) {
  const skupiny = new Map<string, HistorieZmeny[]>();

  for (const item of historie) {
    const oblast = getOblast(item.typ);
    const klic = `${oblast}::${item.skladova_polozka_id ?? "bez-polozky"}`;

    if (!skupiny.has(klic)) {
      skupiny.set(klic, []);
    }

    skupiny.get(klic)!.push(item);
  }

  const vystup: SouhrnRadek[] = [];

  for (const [klic, polozky] of skupiny.entries()) {
    const serazene = [...polozky].sort(seradHistoriiVzestupne);
    const prvni = serazene[0];
    const posledni = serazene[serazene.length - 1];
    const oblast = getOblast(prvni.typ);

    vystup.push({
      klic,
      zdroj: "legacy",
      oblast,
      skladova_polozka_id: prvni.skladova_polozka_id,
      nazev_polozky: prvni.nazev_polozky,
      udalost: formatOblast(oblast),
      stav_od: prvni.stara_hodnota ?? 0,
      stav_do: posledni.nova_hodnota ?? 0,
      created_at_od: prvni.created_at,
      created_at_do: posledni.created_at,
      pocet_zmen: serazene.length,
      evidencni_cislo: null,
      poznamka: null,
    });
  }

  return vystup.sort((a, b) => {
    const aTime = a.created_at_do ? new Date(a.created_at_do).getTime() : 0;
    const bTime = b.created_at_do ? new Date(b.created_at_do).getTime() : 0;

    if (aTime !== bTime) return bTime - aTime;

    return (a.nazev_polozky || "").localeCompare(b.nazev_polozky || "", "cs");
  });
}

async function nactiData(zakazkaId: string) {
  const { data: zakazka } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev")
    .eq("zakazka_id", zakazkaId)
    .single();

  const { data: historieRaw } = await supabase
    .from("historie_zmen")
    .select("historie_id, zakazka_id, skladova_polozka_id, typ, stara_hodnota, nova_hodnota, created_at")
    .eq("zakazka_id", zakazkaId)
    .order("created_at", { ascending: false })
    .limit(1000);

  const historieRows = (historieRaw ?? []) as HistorieZmenyRow[];

  const { data: scanHistorieRaw } = await supabase
    .from("sklad_kus_historie")
    .select("historie_id, kus_id, zakazka_id, typ_akce, poznamka, created_at")
    .eq("zakazka_id", zakazkaId)
    .order("created_at", { ascending: false })
    .limit(1000);

  const scanHistorieRows = (scanHistorieRaw ?? []) as SkladKusHistorieRow[];
  const kusIds = Array.from(
    new Set(scanHistorieRows.map((i) => i.kus_id).filter((v): v is string => Boolean(v)))
  );

  let kusyMap = new Map<string, SkladKusRow>();
  if (kusIds.length > 0) {
    const { data: kusyRaw } = await supabase
      .from("sklad_polozky_kusy")
      .select("kus_id, skladova_polozka_id, poradove_cislo, evidencni_cislo")
      .in("kus_id", kusIds);

    const kusy = (kusyRaw ?? []) as SkladKusRow[];
    kusyMap = new Map(kusy.map((kus) => [kus.kus_id, kus]));
  }

  const ids = Array.from(
    new Set(
      [
        ...historieRows.map((i) => i.skladova_polozka_id),
        ...Array.from(kusyMap.values()).map((kus) => kus.skladova_polozka_id),
      ].filter((v): v is string => Boolean(v))
    )
  );

  let nazvyMap = new Map<string, string>();

  if (ids.length > 0) {
    const { data: polozkyRaw } = await supabase
      .from("skladove_polozky")
      .select("skladova_polozka_id, nazev")
      .in("skladova_polozka_id", ids);

    const polozky = (polozkyRaw ?? []) as SkladovaPolozka[];
    nazvyMap = new Map(polozky.map((p) => [p.skladova_polozka_id, p.nazev]));
  }

  const historie: HistorieZmeny[] = historieRows.map((item) => ({
    ...item,
    nazev_polozky: item.skladova_polozka_id
      ? (nazvyMap.get(item.skladova_polozka_id) ?? null)
      : null,
  }));

  const scanSouhrn: SouhrnRadek[] = scanHistorieRows.map((item) => {
    const kus = kusyMap.get(item.kus_id);

    return {
      klic: `scan::${item.historie_id}`,
      zdroj: "scan",
      oblast: "nakladka",
      skladova_polozka_id: kus?.skladova_polozka_id ?? null,
      nazev_polozky: kus?.skladova_polozka_id
        ? (nazvyMap.get(kus.skladova_polozka_id) ?? null)
        : null,
      udalost: formatScanAuditUdalost(item.typ_akce, item.poznamka),
      stav_od: 0,
      stav_do: 0,
      created_at_od: item.created_at,
      created_at_do: item.created_at,
      pocet_zmen: 1,
      evidencni_cislo: kus?.evidencni_cislo?.trim() || null,
      poznamka: item.poznamka,
    };
  });

  return {
    zakazka: zakazka as Zakazka,
    souhrn: [...vytvorSouhrn(historie), ...scanSouhrn].sort((a, b) => {
      const aTime = a.created_at_do ? new Date(a.created_at_do).getTime() : 0;
      const bTime = b.created_at_do ? new Date(b.created_at_do).getTime() : 0;

      if (aTime !== bTime) return bTime - aTime;
      return a.klic.localeCompare(b.klic);
    }),
  };
}

function OblastBadge({ oblast }: { oblast: "technika" | "nakladka" | "jine" }) {
  if (oblast === "technika") {
    return <Badge variant="default">Technika</Badge>;
  }

  if (oblast === "nakladka") {
    return <Badge variant="success">Nakládka</Badge>;
  }

  return <Badge variant="warning">Jiné</Badge>;
}

export default async function HistorieZakazkyPage({ params }: PageProps) {
  noStore();

  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;

  if (user?.id) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    role = data?.role ?? null;
  }

  const perms = getRolePermissions(role);

  if (!perms.historieCteni) {
    return (
      <div className="w-full">
        <Card className="border-red-900/50 bg-red-950/30">
          <div className="flex items-center gap-3">
            <Badge variant="danger">Bez oprávnění</Badge>
            <div className="text-sm text-red-100">Nemáš oprávnění</div>
          </div>
        </Card>
      </div>
    );
  }

  const { zakazka, souhrn } = await nactiData(id);

  return (
    <div className="w-full">
      <PageHeader
        title="Historie změn"
        description={`${zakazka.cislo_zakazky} — ${zakazka.nazev}`}
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="default">{zakazka.cislo_zakazky}</Badge>
              <Badge variant="default">Historie zakázky</Badge>
            </div>

            <div className="text-sm text-slate-400">
              Souhrn změn techniky, nakládky a dalších položek na zakázce.
            </div>
          </div>

          <ZakazkaSubnav zakazkaId={id} active="historie" />
        </div>
      </Card>

      {souhrn.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">Zatím bez historie.</div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {souhrn.map((item) => (
            <Card key={item.klic} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <OblastBadge oblast={item.oblast} />
                    <div className="text-lg font-semibold text-white">
                      {item.udalost}
                    </div>
                  </div>

                  <div className="text-sm text-slate-400">
                    {item.zdroj === "scan"
                      ? formatDatumCas(item.created_at_do)
                      : `${formatDatumCas(item.created_at_od)} → ${formatDatumCas(item.created_at_do)}`}
                  </div>
                </div>

                <Badge variant="default">
                  {item.zdroj === "scan" ? "Scan audit" : `${item.pocet_zmen} změn`}
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3">
                  <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                    Položka
                  </div>
                  <div className="text-sm text-slate-200">
                    {item.nazev_polozky || "—"}
                  </div>
                </div>

                {item.zdroj === "scan" ? (
                  <>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3">
                      <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                        Kus
                      </div>
                      <div className="text-sm text-slate-200">
                        {item.evidencni_cislo || "—"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3">
                      <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                        Poznámka
                      </div>
                      <div className="text-sm text-slate-200">
                        {item.poznamka?.trim() || "—"}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3">
                      <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                        Stav
                      </div>
                      <div className="text-sm text-slate-200">
                        {item.stav_od} → {item.stav_do}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3">
                      <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                        Změna
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {getZmena(item.stav_od, item.stav_do)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}