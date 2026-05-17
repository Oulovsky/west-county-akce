import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import ZakazkyListClient, { type Zakazka } from "./ZakazkyListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type DeclinedPeopleRow = {
  zakazka_id: string;
};

export default async function ZakazkyPage() {
  noStore();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, misto, misto_id, datum_od, datum_do, cas_od, cas_do, zrusena, logistika_stav, client_approval_status, workflow_stav, workflow_change_pending, workflow_change_summary")
    .order("datum_od", { ascending: true })
    .order("cas_od", { ascending: true });

  if (error) {
    return <div>Chyba: {error.message}</div>;
  }

  async function smazatTrvale(formData: FormData) {
    "use server";

    const zakazkaId = String(formData.get("zakazka_id") || "").trim();
    if (!zakazkaId) return;

    throw new Error("Zrušená zakázka se nemaže. Zůstává v historii a auditu.");
  }

  const zakazky: Zakazka[] = (data ?? []) as Zakazka[];
  const zakazkaIds = zakazky.map((zakazka) => zakazka.zakazka_id);

  if (zakazkaIds.length > 0) {
    const { data: declinedRaw, error: declinedError } = await supabase
      .from("zakazka_lide")
      .select("zakazka_id")
      .eq("confirmation_status", "declined")
      .in("zakazka_id", zakazkaIds);

    if (declinedError) {
      return <div>Chyba odmítnutí lidí: {declinedError.message}</div>;
    }

    const declinedCountsByZakazka = new Map<string, number>();
    for (const row of (declinedRaw ?? []) as DeclinedPeopleRow[]) {
      declinedCountsByZakazka.set(
        row.zakazka_id,
        (declinedCountsByZakazka.get(row.zakazka_id) ?? 0) + 1
      );
    }

    for (const zakazka of zakazky) {
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