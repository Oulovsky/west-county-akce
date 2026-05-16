import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRolePermissions } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ZakazkaSubnav } from "@/components/zakazky/zakazka-subnav";
import NakladkaClient from "./NakladkaClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Radek = {
  skladova_polozka_id: string;
  nazev: string;
  plan: number;
  nalozeno: number;
};

type TechnikaRow = {
  zakazka_id?: string;
  skladova_polozka_id: string;
  mnozstvi: number | string;
};

type SkladRow = {
  skladova_polozka_id: string;
  nazev: string;
};

type NakladkaRow = {
  skladova_polozka_id: string;
  nalozeno: number;
  updated_at?: string | null;
};

type ZakazkaInfo = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  datum_od?: string | null;
  datum_do?: string | null;
  cas_od?: string | null;
  cas_do?: string | null;
  odjezd_ze_skladu?: string | null;
  sraz_na_miste?: string | null;
  stavba_od?: string | null;
  stavba_do?: string | null;
  akce_od?: string | null;
  akce_do?: string | null;
  bourani_od?: string | null;
  bourani_do?: string | null;
};

type CompareItem = {
  skladova_polozka_id: string;
  nazev: string;
  plan: number;
};

type CompareZakazkaOption = {
  zakazka_id: string;
  label: string;
  items: CompareItem[];
};

type SkladRpcRow = {
  skladova_polozka_id: string;
  nazev: string;
};

function parseDateCandidate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function combineDateAndTime(dateValue?: string | null, timeValue?: string | null) {
  if (!dateValue) return null;

  const safeTime =
    timeValue && /^\d{2}:\d{2}(:\d{2})?$/.test(timeValue) ? timeValue : "00:00:00";

  const iso = `${dateValue}T${safeTime.length === 5 ? `${safeTime}:00` : safeTime}`;
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getZakazkaSortDate(zakazka: ZakazkaInfo) {
  return (
    parseDateCandidate(zakazka.odjezd_ze_skladu) ??
    parseDateCandidate(zakazka.sraz_na_miste) ??
    parseDateCandidate(zakazka.stavba_od) ??
    parseDateCandidate(zakazka.akce_od) ??
    parseDateCandidate(zakazka.bourani_od) ??
    combineDateAndTime(zakazka.datum_od, zakazka.cas_od) ??
    combineDateAndTime(zakazka.datum_do, zakazka.cas_do)
  );
}

function formatDateLabel(zakazka: ZakazkaInfo) {
  const d = getZakazkaSortDate(zakazka);
  if (!d) return "bez data";

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function buildZakazkaLabel(zakazka: ZakazkaInfo) {
  const cislo = zakazka.cislo_zakazky?.trim() || "—";
  const nazev = zakazka.nazev?.trim() || "Zakázka";
  const datum = formatDateLabel(zakazka);
  return `${cislo} — ${nazev} — ${datum}`;
}

export default async function NakladkaPage({ params }: PageProps) {
  noStore();

  const { id } = await params;
  const supabase = await createClient();

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

  if (!perms.nakladkaCteni) {
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

  const canEdit = perms.nakladkaEditace;

  async function pridej(formData: FormData) {
    "use server";

    if (!canEdit) return;

    const supabase = await createClient();

    const zakazkaId = String(formData.get("zakazka_id") || "");
    const polozkaId = String(formData.get("skladova_polozka_id") || "");

    const { error } = await supabase.rpc("zmen_nakladku", {
      p_zakazka_id: zakazkaId,
      p_skladova_polozka_id: polozkaId,
      p_delta: 1,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/zakazky/${zakazkaId}/nakladka`);
    revalidatePath(`/zakazky/${zakazkaId}/technika`);
    revalidatePath(`/zakazky/${zakazkaId}`);
  }

  async function uber(formData: FormData) {
    "use server";

    if (!canEdit) return;

    const supabase = await createClient();

    const zakazkaId = String(formData.get("zakazka_id") || "");
    const polozkaId = String(formData.get("skladova_polozka_id") || "");

    const { error } = await supabase.rpc("zmen_nakladku", {
      p_zakazka_id: zakazkaId,
      p_skladova_polozka_id: polozkaId,
      p_delta: -1,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/zakazky/${zakazkaId}/nakladka`);
    revalidatePath(`/zakazky/${zakazkaId}/technika`);
    revalidatePath(`/zakazky/${zakazkaId}`);
  }

  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from("zakazky")
    .select(`
      zakazka_id,
      cislo_zakazky,
      nazev,
      datum_od,
      datum_do,
      cas_od,
      cas_do,
      odjezd_ze_skladu,
      sraz_na_miste,
      stavba_od,
      stavba_do,
      akce_od,
      akce_do,
      bourani_od,
      bourani_do
    `)
    .eq("zakazka_id", id)
    .single();

  if (zakazkaError) {
    return <div>Chyba zakázky: {zakazkaError.message}</div>;
  }

  const zakazka = (zakazkaRaw ?? null) as ZakazkaInfo | null;

  const { data: technikaRaw, error: technikaError } = await supabase
    .from("technika_na_zakazce")
    .select("zakazka_id, skladova_polozka_id, mnozstvi")
    .eq("zakazka_id", id);

  const technika = (technikaRaw || []) as TechnikaRow[];

  if (technikaError) {
    return <div>Chyba techniky: {technikaError.message}</div>;
  }

  const { data: skladRpcRaw, error: skladError } = await supabase.rpc("get_skladove_polozky");

  if (skladError) {
    return <div>Chyba skladu: {skladError.message}</div>;
  }

  const sklad = ((skladRpcRaw || []) as SkladRpcRow[]).map((row) => ({
    skladova_polozka_id: row.skladova_polozka_id,
    nazev: row.nazev,
  })) as SkladRow[];

  const { data: nakladkaRaw, error: nakladkaError } = await supabase
    .from("nakladka")
    .select("skladova_polozka_id, nalozeno, updated_at")
    .eq("zakazka_id", id);

  const nakladka = (nakladkaRaw || []) as NakladkaRow[];

  if (nakladkaError) {
    return <div>Chyba nakládky: {nakladkaError.message}</div>;
  }

  const skladMap = new Map<string, string>();
  for (const item of sklad) {
    skladMap.set(item.skladova_polozka_id, item.nazev);
  }

  const radky: Radek[] = technika
    .map((t: TechnikaRow) => {
      const nalozeno =
        nakladka.find(
          (n: NakladkaRow) => n.skladova_polozka_id === t.skladova_polozka_id
        )?.nalozeno || 0;

      return {
        skladova_polozka_id: t.skladova_polozka_id,
        nazev: skladMap.get(t.skladova_polozka_id) ?? t.skladova_polozka_id,
        plan: Number(t.mnozstvi) || 0,
        nalozeno,
      };
    })
    .sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));

  let compareOptions: CompareZakazkaOption[] = [];
  let autoCompareZakazkaId: string | null = null;

  const { data: allZakazkyRaw, error: allZakazkyError } = await supabase
    .from("zakazky")
    .select(`
      zakazka_id,
      cislo_zakazky,
      nazev,
      datum_od,
      datum_do,
      cas_od,
      cas_do,
      odjezd_ze_skladu,
      sraz_na_miste,
      stavba_od,
      stavba_do,
      akce_od,
      akce_do,
      bourani_od,
      bourani_do
    `)
    .neq("zakazka_id", id);

  if (allZakazkyError) {
    return <div>Chyba porovnání zakázek: {allZakazkyError.message}</div>;
  }

  const allZakazky = (allZakazkyRaw || []) as ZakazkaInfo[];
  const currentSortDate = zakazka ? getZakazkaSortDate(zakazka) : null;

  const sortedZakazky = [...allZakazky].sort((a, b) => {
    const aDate = getZakazkaSortDate(a);
    const bDate = getZakazkaSortDate(b);

    const aTime = aDate ? aDate.getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = bDate ? bDate.getTime() : Number.MAX_SAFE_INTEGER;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return (a.cislo_zakazky || "").localeCompare(b.cislo_zakazky || "", "cs");
  });

  const futureZakazky = sortedZakazky.filter((item) => {
    if (!currentSortDate) return true;

    const itemDate = getZakazkaSortDate(item);
    if (!itemDate) return false;

    return itemDate.getTime() > currentSortDate.getTime();
  });

  autoCompareZakazkaId = futureZakazky[0]?.zakazka_id ?? null;

  const compareZakazkySource =
    futureZakazky.length > 0 ? futureZakazky : sortedZakazky;

  const compareZakazky = compareZakazkySource.slice(0, 20);
  const compareZakazkyIds = compareZakazky.map((item) => item.zakazka_id);

  if (compareZakazkyIds.length > 0) {
    const { data: compareTechnikaRaw, error: compareTechnikaError } = await supabase
      .from("technika_na_zakazce")
      .select("zakazka_id, skladova_polozka_id, mnozstvi")
      .in("zakazka_id", compareZakazkyIds);

    if (compareTechnikaError) {
      return <div>Chyba porovnání techniky: {compareTechnikaError.message}</div>;
    }

    const compareTechnika = (compareTechnikaRaw || []) as TechnikaRow[];

    compareOptions = compareZakazky.map((item) => {
      const items: CompareItem[] = compareTechnika
        .filter((row) => row.zakazka_id === item.zakazka_id)
        .map((row) => ({
          skladova_polozka_id: row.skladova_polozka_id,
          nazev: skladMap.get(row.skladova_polozka_id) ?? row.skladova_polozka_id,
          plan: Number(row.mnozstvi) || 0,
        }))
        .sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));

      return {
        zakazka_id: item.zakazka_id,
        label: buildZakazkaLabel(item),
        items,
      };
    });
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Nakládka"
        description={
          zakazka
            ? `${zakazka.cislo_zakazky ?? "—"} — ${zakazka.nazev ?? "Zakázka"}`
            : "Průběh nakládky techniky na zakázku."
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {zakazka?.cislo_zakazky ? (
                <Badge variant="default">{zakazka.cislo_zakazky}</Badge>
              ) : null}

              <Badge variant={canEdit ? "success" : "warning"}>
                {canEdit ? "Editace povolena" : "Jen čtení"}
              </Badge>
            </div>

            <div className="text-sm text-slate-400">
              Nakládka vychází z plánované techniky na zakázce.
            </div>
          </div>

          <ZakazkaSubnav zakazkaId={id} active="nakladka" />
        </div>
      </Card>

      <NakladkaClient
        initialData={radky}
        zakazkaId={id}
        pridejAction={pridej}
        uberAction={uber}
        canEdit={canEdit}
        compareOptions={compareOptions}
        autoCompareZakazkaId={autoCompareZakazkaId}
      />
    </div>
  );
}