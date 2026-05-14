import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRolePermissions } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ZakazkaSubnav } from "@/components/zakazky/zakazka-subnav";
import TechnikaClient from "./TechnikaClient";

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
  datum_od: string;
  datum_do: string;
  cas_od: string | null;
  cas_do: string | null;
};

type SkladovaPolozka = {
  skladova_polozka_id: string;
  nazev: string;
  celkem_k_dispozici: number;
  poskozene: number;
};

type TechnikaNaZakazce = {
  zakazka_id: string;
  skladova_polozka_id: string;
  mnozstvi: number;
};

type StavTechnikyNaZakazce = {
  skladova_polozka_id: string;
  nazev: string;
  mnozstvi: number;
};

type Radek = {
  skladova_polozka_id: string;
  nazev: string;
  sklad_celkem: number;
  poskozene: number;
  na_zakazce: number;
  skutecne_na_zakazce: number;
  rezervovano_jinde: number;
  k_dispozici: number;
  max_na_teto_zakazce: number;
};

function normalizeTime(value: string | null | undefined, fallback: string) {
  if (!value || value.trim() === "") return fallback;
  return value.length === 5 ? `${value}:00` : value;
}

function toDateTime(datum: string, cas: string) {
  return new Date(`${datum}T${cas}`);
}

function getStart(z: Zakazka) {
  return toDateTime(z.datum_od, normalizeTime(z.cas_od, "00:00:00"));
}

function getEnd(z: Zakazka) {
  return toDateTime(z.datum_do, normalizeTime(z.cas_do, "23:59:59"));
}

function koliduje(a: Zakazka, b: Zakazka) {
  const aStart = getStart(a).getTime();
  const aEnd = getEnd(a).getTime();
  const bStart = getStart(b).getTime();
  const bEnd = getEnd(b).getTime();

  return aStart <= bEnd && aEnd >= bStart;
}

async function nactiData(zakazkaId: string) {
  const supabase = await createClient();

  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, datum_od, datum_do, cas_od, cas_do")
    .eq("zakazka_id", zakazkaId)
    .single();

  if (zakazkaError || !zakazkaRaw) {
    throw new Error(zakazkaError?.message ?? "Zakázka nebyla nalezena.");
  }

  const zakazka = zakazkaRaw as Zakazka;

  const { data: vsechnyZakazkyRaw, error: vsechnyZakazkyError } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, datum_od, datum_do, cas_od, cas_do")
    .neq("zakazka_id", zakazkaId);

  if (vsechnyZakazkyError) {
    throw new Error(vsechnyZakazkyError.message);
  }

  const vsechnyZakazky = (vsechnyZakazkyRaw || []) as Zakazka[];

  const kolidujiciZakazky = vsechnyZakazky.filter((z: Zakazka) => koliduje(zakazka, z));
  const kolidujiciIds = kolidujiciZakazky.map((z: Zakazka) => z.zakazka_id);

  const { data: skladovePolozkyRaw, error: skladError } = await supabase.rpc(
    "get_skladove_polozky"
  );

  if (skladError) {
    throw new Error(skladError.message);
  }

  const skladovePolozky = ((skladovePolozkyRaw || []) as Array<{
    skladova_polozka_id: string;
    nazev: string;
    celkem_k_dispozici: number | string;
    poskozene?: number | string | null;
  }>).map((row) => ({
    skladova_polozka_id: row.skladova_polozka_id,
    nazev: row.nazev,
    celkem_k_dispozici: Number(row.celkem_k_dispozici ?? 0),
    poskozene: Number(row.poskozene ?? 0),
  })) as SkladovaPolozka[];

  const { data: technikaNaTetoZakazceRaw, error: technikaNaTetoZakazceError } = await supabase
    .from("technika_na_zakazce")
    .select("zakazka_id, skladova_polozka_id, mnozstvi")
    .eq("zakazka_id", zakazkaId);

  if (technikaNaTetoZakazceError) {
    throw new Error(technikaNaTetoZakazceError.message);
  }

  const technikaNaTetoZakazce = (technikaNaTetoZakazceRaw || []) as TechnikaNaZakazce[];

  const { data: skutecnyStavRaw, error: skutecnyStavError } = await supabase.rpc(
    "get_stav_techniky_na_zakazce",
    { p_zakazka_id: zakazkaId }
  );

  if (skutecnyStavError) {
    throw new Error(skutecnyStavError.message);
  }

  const skutecnyStav = (skutecnyStavRaw || []) as StavTechnikyNaZakazce[];

  let technikaJinde: TechnikaNaZakazce[] = [];

  if (kolidujiciIds.length > 0) {
    const { data, error } = await supabase
      .from("technika_na_zakazce")
      .select("zakazka_id, skladova_polozka_id, mnozstvi")
      .in("zakazka_id", kolidujiciIds);

    if (error) {
      throw new Error(error.message);
    }

    technikaJinde = (data || []) as TechnikaNaZakazce[];
  }

  const radky: Radek[] = skladovePolozky.map((polozka: SkladovaPolozka) => {
    const naZakazce =
      technikaNaTetoZakazce.find(
        (t: TechnikaNaZakazce) => t.skladova_polozka_id === polozka.skladova_polozka_id
      )?.mnozstvi ?? 0;

    const skutecneNaZakazce =
      skutecnyStav.find(
        (t: StavTechnikyNaZakazce) => t.skladova_polozka_id === polozka.skladova_polozka_id
      )?.mnozstvi ?? 0;

    const rezervovanoJinde = technikaJinde
      .filter((t: TechnikaNaZakazce) => t.skladova_polozka_id === polozka.skladova_polozka_id)
      .reduce((sum: number, t: TechnikaNaZakazce) => sum + Number(t.mnozstvi ?? 0), 0);

    const poskozene = Number(polozka.poskozene ?? 0);
    const maxNaTetoZakazce = Math.max(
      0,
      Number(polozka.celkem_k_dispozici ?? 0) - rezervovanoJinde - poskozene
    );
    const kDispozici = Math.max(0, maxNaTetoZakazce - naZakazce);

    return {
      skladova_polozka_id: polozka.skladova_polozka_id,
      nazev: polozka.nazev,
      sklad_celkem: Number(polozka.celkem_k_dispozici ?? 0),
      poskozene,
      na_zakazce: Number(naZakazce ?? 0),
      skutecne_na_zakazce: Number(skutecneNaZakazce ?? 0),
      rezervovano_jinde: Number(rezervovanoJinde ?? 0),
      k_dispozici: Number(kDispozici ?? 0),
      max_na_teto_zakazce: Number(maxNaTetoZakazce ?? 0),
    };
  });

  return {
    zakazka,
    radky,
  };
}

export default async function TechnikaZakazkyPage({ params }: PageProps) {
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

  if (!perms.technikaCteni) {
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

  const canEdit = perms.technikaEditace;

  async function pridej(formData: FormData) {
    "use server";

    if (!canEdit) return;

    const supabase = await createClient();

    const zakazkaId = String(formData.get("zakazka_id") || "");
    const skladovaPolozkaId = String(formData.get("skladova_polozka_id") || "");

    const { radky } = await nactiData(zakazkaId);
    const radek = radky.find((r: Radek) => r.skladova_polozka_id === skladovaPolozkaId);
    if (!radek) return;

    if (radek.na_zakazce >= radek.max_na_teto_zakazce) {
      revalidatePath(`/zakazky/${zakazkaId}/technika`);
      return;
    }

    const noveMnozstvi = radek.na_zakazce + 1;

    const { error } = await supabase.from("technika_na_zakazce").upsert(
      {
        zakazka_id: zakazkaId,
        skladova_polozka_id: skladovaPolozkaId,
        mnozstvi: noveMnozstvi,
      },
      { onConflict: "zakazka_id,skladova_polozka_id" }
    );

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/zakazky/${zakazkaId}/technika`);
    revalidatePath(`/zakazky/${zakazkaId}`);
    revalidatePath("/zakazky");
  }

  async function uber(formData: FormData) {
    "use server";

    if (!canEdit) return;

    const supabase = await createClient();

    const zakazkaId = String(formData.get("zakazka_id") || "");
    const skladovaPolozkaId = String(formData.get("skladova_polozka_id") || "");

    const { radky } = await nactiData(zakazkaId);
    const radek = radky.find((r: Radek) => r.skladova_polozka_id === skladovaPolozkaId);
    if (!radek) return;

    if (radek.na_zakazce <= 0) {
      revalidatePath(`/zakazky/${zakazkaId}/technika`);
      return;
    }

    const noveMnozstvi = radek.na_zakazce - 1;

    if (noveMnozstvi <= 0) {
      const { error } = await supabase
        .from("technika_na_zakazce")
        .delete()
        .eq("zakazka_id", zakazkaId)
        .eq("skladova_polozka_id", skladovaPolozkaId);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabase
        .from("technika_na_zakazce")
        .update({ mnozstvi: noveMnozstvi })
        .eq("zakazka_id", zakazkaId)
        .eq("skladova_polozka_id", skladovaPolozkaId);

      if (error) {
        throw new Error(error.message);
      }
    }

    revalidatePath(`/zakazky/${zakazkaId}/technika`);
    revalidatePath(`/zakazky/${zakazkaId}`);
    revalidatePath("/zakazky");
  }

  const { zakazka, radky } = await nactiData(id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <PageHeader
        title="Technika zakázky"
        description={`${zakazka.cislo_zakazky} — ${zakazka.nazev}`}
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="default">{zakazka.cislo_zakazky}</Badge>
              <Badge variant={canEdit ? "success" : "warning"}>
                {canEdit ? "Editace povolena" : "Jen čtení"}
              </Badge>
            </div>

            <div className="text-sm text-slate-400">
              Plánovaná technika vs. reálný stav po nakládce, vratkách a přesunech.
            </div>
          </div>

          <ZakazkaSubnav zakazkaId={id} active="technika" />
        </div>
      </Card>

      <TechnikaClient
        initialData={radky}
        zakazkaId={zakazka.zakazka_id}
        pridejAction={pridej}
        uberAction={uber}
        canEdit={canEdit}
      />
    </div>
  );
}