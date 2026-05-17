import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import ZakazkyListClient, { type Zakazka } from "./ZakazkyListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PlanRow = {
  zakazka_id: string;
  mnozstvi: number | string | null;
};

type ZakazkaKusRow = {
  zakazka_id: string;
  stav: string | null;
};

type DeclinedPeopleRow = {
  zakazka_id: string;
};

function getLoadingStatusLabel({
  plan,
  aktivni,
  vraceno,
  poskozeno,
}: {
  plan: number;
  aktivni: number;
  vraceno: number;
  poskozeno: number;
}) {
  if (aktivni === 0 && vraceno > 0 && poskozeno > 0) return "Vráceno s poškozením";
  if (aktivni === 0 && vraceno > 0) return "Vráceno";
  if (aktivni === 0) return "Nenaloženo";
  if (vraceno > 0 && aktivni > 0) return "Částečně vráceno";
  if (aktivni > 0 && aktivni < plan) return "Částečně naloženo";
  if (aktivni >= plan && vraceno === 0) return "Naloženo";
  return "Částečně naloženo";
}

export default async function ZakazkyPage() {
  noStore();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, misto, misto_id, datum_od, datum_do, cas_od, cas_do, zrusena")
    .order("datum_od", { ascending: true })
    .order("cas_od", { ascending: true });

  if (error) {
    return <div>Chyba: {error.message}</div>;
  }

  async function smazatTrvale(formData: FormData) {
    "use server";

    const zakazkaId = String(formData.get("zakazka_id") || "").trim();
    if (!zakazkaId) return;

    const supabase = await createClient();

    const { error: rpcError } = await supabase.rpc("smazat_zrusenou_zakazku", {
      p_zakazka_id: zakazkaId,
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    revalidatePath("/zakazky");
    revalidatePath("/kalendar");
  }

  const zakazky: Zakazka[] = (data ?? []) as Zakazka[];
  const zakazkaIds = zakazky.map((zakazka) => zakazka.zakazka_id);

  if (zakazkaIds.length > 0) {
    const [
      { data: planRaw, error: planError },
      { data: kusyRaw, error: kusyError },
      { data: declinedRaw, error: declinedError },
    ] = await Promise.all([
      supabase
        .from("technika_na_zakazce")
        .select("zakazka_id, mnozstvi")
        .in("zakazka_id", zakazkaIds),
      supabase
        .from("zakazka_kusy")
        .select("zakazka_id, stav")
        .in("zakazka_id", zakazkaIds),
      supabase
        .from("zakazka_lide")
        .select("zakazka_id")
        .eq("confirmation_status", "declined")
        .in("zakazka_id", zakazkaIds),
    ]);

    if (planError) {
      return <div>Chyba plánu nakládky: {planError.message}</div>;
    }

    if (kusyError) {
      return <div>Chyba stavu nakládky: {kusyError.message}</div>;
    }

    if (declinedError) {
      return <div>Chyba odmítnutí lidí: {declinedError.message}</div>;
    }

    const planByZakazka = new Map<string, number>();
    for (const row of (planRaw ?? []) as PlanRow[]) {
      const value = Number(row.mnozstvi ?? 0);
      planByZakazka.set(
        row.zakazka_id,
        (planByZakazka.get(row.zakazka_id) ?? 0) + (Number.isFinite(value) ? value : 0)
      );
    }

    const countsByZakazka = new Map<
      string,
      { aktivni: number; vraceno: number; poskozeno: number }
    >();
    for (const row of (kusyRaw ?? []) as ZakazkaKusRow[]) {
      const counts = countsByZakazka.get(row.zakazka_id) ?? {
        aktivni: 0,
        vraceno: 0,
        poskozeno: 0,
      };

      if (row.stav === "vraceno") {
        counts.vraceno += 1;
      } else {
        counts.aktivni += 1;
        if (row.stav === "poskozeno") counts.poskozeno += 1;
      }

      countsByZakazka.set(row.zakazka_id, counts);
    }

    const declinedCountsByZakazka = new Map<string, number>();
    for (const row of (declinedRaw ?? []) as DeclinedPeopleRow[]) {
      declinedCountsByZakazka.set(
        row.zakazka_id,
        (declinedCountsByZakazka.get(row.zakazka_id) ?? 0) + 1
      );
    }

    for (const zakazka of zakazky) {
      const counts = countsByZakazka.get(zakazka.zakazka_id) ?? {
        aktivni: 0,
        vraceno: 0,
        poskozeno: 0,
      };

      zakazka.loading_status = getLoadingStatusLabel({
        plan: planByZakazka.get(zakazka.zakazka_id) ?? 0,
        aktivni: counts.aktivni,
        vraceno: counts.vraceno,
        poskozeno: counts.poskozeno,
      });
      zakazka.declined_people_count = declinedCountsByZakazka.get(zakazka.zakazka_id) ?? 0;
    }
  }

  return (
    <ZakazkyListClient
      initialZakazky={zakazky}
      smazatTrvaleAction={smazatTrvale}
    />
  );
}