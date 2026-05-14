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

type SkladovaPolozka = {
  skladova_polozka_id: string;
  nazev: string;
};

type SouhrnRadek = {
  klic: string;
  oblast: "technika" | "nakladka" | "jine";
  skladova_polozka_id: string | null;
  nazev_polozky: string | null;
  stav_od: number;
  stav_do: number;
  created_at_od: string | null;
  created_at_do: string | null;
  pocet_zmen: number;
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
      oblast,
      skladova_polozka_id: prvni.skladova_polozka_id,
      nazev_polozky: prvni.nazev_polozky,
      stav_od: prvni.stara_hodnota ?? 0,
      stav_do: posledni.nova_hodnota ?? 0,
      created_at_od: prvni.created_at,
      created_at_do: posledni.created_at,
      pocet_zmen: serazene.length,
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

  const ids = Array.from(
    new Set(
      historieRows
        .map((i) => i.skladova_polozka_id)
        .filter((v): v is string => Boolean(v))
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

  return {
    zakazka: zakazka as Zakazka,
    souhrn: vytvorSouhrn(historie),
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
      <div className="mx-auto w-full max-w-5xl px-4">
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
    <div className="mx-auto w-full max-w-6xl px-4">
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
                      {formatOblast(item.oblast)}
                    </div>
                  </div>

                  <div className="text-sm text-slate-400">
                    {formatDatumCas(item.created_at_od)} → {formatDatumCas(item.created_at_do)}
                  </div>
                </div>

                <Badge variant="default">{item.pocet_zmen} změn</Badge>
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}