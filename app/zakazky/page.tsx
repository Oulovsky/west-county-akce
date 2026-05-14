import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import ZakazkyListClient, { type Zakazka } from "./ZakazkyListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ZakazkyPage() {
  noStore();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, misto, datum_od, datum_do, cas_od, cas_do, zrusena")
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

  return (
    <ZakazkyListClient
      initialZakazky={zakazky}
      smazatTrvaleAction={smazatTrvale}
    />
  );
}