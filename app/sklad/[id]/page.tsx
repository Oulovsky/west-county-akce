import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeCelkemKusu,
  computePouzitelneKusy,
  sumBlokujiciPoskozeneKusy,
  toNumber,
} from "@/lib/sklad/helpers";
import type {
  SkladDetailRow,
  SkladJednotka,
  SkladKategorie,
  SkladKusRow,
  SkladPodkategorie,
  SkladPoskozeniRow,
  SkladPrioritaOption,
  SkladTypPoskozeniOption,
} from "@/lib/sklad/types";
import {
  SkladDetailConfigError,
  SkladDetailLoadError,
  SkladDetailNotFound,
} from "./components/SkladDetailAlerts";
import { SkladDetailBasicInfo } from "./components/SkladDetailBasicInfo";
import { SkladDetailEvidenceSection } from "./components/SkladDetailEvidenceSection";
import { SkladDetailFinance } from "./components/SkladDetailFinance";
import { SkladDetailHeader } from "./components/SkladDetailHeader";
import { SkladDetailItemsTable } from "./components/SkladDetailItemsTable";
import { SkladDetailMetaSection } from "./components/SkladDetailMetaSection";
import { SkladDetailReportDamageSection } from "./components/SkladDetailReportDamageSection";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function prepocitatPocetKusu(skladovaPolozkaId: string) {
  "use server";

  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("sklad_polozky_kusy")
    .select("kus_id", { count: "exact", head: true })
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (countError) throw new Error(countError.message);

  const { error: updateError } = await supabase
    .from("skladove_polozky")
    .update({
      celkem_k_dispozici: count ?? 0,
      upraveno_dne: new Date().toISOString(),
    })
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (updateError) throw new Error(updateError.message);
}

export default async function SkladDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  async function upravitPolozku(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const skladovaPolozkaId = String(formData.get("skladova_polozka_id") || "");
    const nazev = String(formData.get("nazev") || "").trim();
    const kategorieId = String(formData.get("kategorie_techniky_id") || "");
    const podkategorieId = String(formData.get("podkategorie_techniky_id") || "");
    const poziceRaw = String(formData.get("pozice") || "").trim();
    const jednotka = String(formData.get("jednotka") || "ks").trim();
    const kusy = Number(formData.get("celkem_k_dispozici") || 0);
    const akceCenaRaw = String(formData.get("interni_naklad") || "").trim();
    const rentRaw = String(formData.get("fakturacni_cena") || "").trim();

    const pozice = poziceRaw === "" ? null : Number(poziceRaw);
    const akceCena = akceCenaRaw === "" ? null : Number(akceCenaRaw);
    const rent = rentRaw === "" ? null : Number(rentRaw);

    if (!skladovaPolozkaId) throw new Error("Chybí ID skladové položky.");
    if (!nazev) throw new Error("Název je povinný.");
    if (!jednotka) throw new Error("Jednotka je povinná.");
    if (!Number.isFinite(kusy) || kusy < 0) throw new Error("Celkem musí být číslo 0 nebo vyšší.");
    if (pozice !== null && !Number.isFinite(pozice)) throw new Error("Pozice musí být číslo.");
    if (akceCena !== null && !Number.isFinite(akceCena)) throw new Error("Akce musí být číslo.");
    if (rent !== null && !Number.isFinite(rent)) throw new Error("Rent musí být číslo.");

    const detailRes = await supabase.rpc("update_skladova_polozka_detail", {
      p_id: skladovaPolozkaId,
      p_nazev: nazev,
      p_kusy: kusy,
      p_jednotka: jednotka,
      p_naklad: akceCena,
      p_rent: rent,
    });

    if (detailRes.error) throw new Error(detailRes.error.message);

    const zakladRes = await supabase
      .from("skladove_polozky")
      .update({
        kategorie_techniky_id: kategorieId || null,
        podkategorie_techniky_id: podkategorieId || null,
        pozice,
        upraveno_dne: new Date().toISOString(),
      })
      .eq("skladova_polozka_id", skladovaPolozkaId);

    if (zakladRes.error) throw new Error(zakladRes.error.message);

    revalidatePath(`/sklad/${skladovaPolozkaId}`);
    revalidatePath("/sklad");
    revalidatePath("/sklad/sprava");
    redirect(`/sklad/${skladovaPolozkaId}`);
  }

  async function pridatKus(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const skladovaPolozkaId = String(formData.get("skladova_polozka_id") || "");
    const nazev = String(formData.get("nazev") || "Kus").trim();

    if (!skladovaPolozkaId) throw new Error("Chybí ID skladové položky.");

    const { data: maxRows, error: maxError } = await supabase
      .from("sklad_polozky_kusy")
      .select("poradove_cislo")
      .eq("skladova_polozka_id", skladovaPolozkaId)
      .order("poradove_cislo", { ascending: false })
      .limit(1);

    if (maxError) throw new Error(maxError.message);

    const nextNumber = toNumber(maxRows?.[0]?.poradove_cislo) + 1 || 1;

    const { error } = await supabase.from("sklad_polozky_kusy").insert({
      skladova_polozka_id: skladovaPolozkaId,
      poradove_cislo: nextNumber,
      evidencni_cislo: `${nazev} #${nextNumber}`,
      stav: "skladem",
      aktivni: true,
    });

    if (error) throw new Error(error.message);

    await prepocitatPocetKusu(skladovaPolozkaId);

    revalidatePath(`/sklad/${skladovaPolozkaId}`);
    revalidatePath("/sklad");
    revalidatePath("/sklad/sprava");
  }

  async function smazatKus(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const skladovaPolozkaId = String(formData.get("skladova_polozka_id") || "");
    const kusId = String(formData.get("kus_id") || "");

    if (!skladovaPolozkaId || !kusId) throw new Error("Chybí ID položky nebo kusu.");

    const { error: poskozeniError } = await supabase
      .from("hlaseni_poskozeni")
      .delete()
      .eq("kus_id", kusId);

    if (poskozeniError) throw new Error(poskozeniError.message);

    const { error } = await supabase
      .from("sklad_polozky_kusy")
      .delete()
      .eq("kus_id", kusId);

    if (error) throw new Error(error.message);

    await prepocitatPocetKusu(skladovaPolozkaId);

    revalidatePath(`/sklad/${skladovaPolozkaId}`);
    revalidatePath("/sklad");
    revalidatePath("/sklad/sprava");
  }

  async function smazatPolozku(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const skladovaPolozkaId = String(formData.get("skladova_polozka_id") || "");

    if (!skladovaPolozkaId) throw new Error("Chybí ID skladové položky.");

    await supabase.from("hlaseni_poskozeni").delete().eq("skladova_polozka_id", skladovaPolozkaId);
    await supabase.from("sklad_polozky_kusy").delete().eq("skladova_polozka_id", skladovaPolozkaId);

    const { error } = await supabase
      .from("skladove_polozky")
      .delete()
      .eq("skladova_polozka_id", skladovaPolozkaId);

    if (error) throw new Error(error.message);

    revalidatePath("/sklad");
    revalidatePath("/sklad/sprava");
    redirect("/sklad/sprava");
  }

  async function nahlasitPoskozeni(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const skladovaPolozkaId = String(formData.get("skladova_polozka_id") || "");
    const kusId = String(formData.get("kus_id") || "");
    const popis = String(formData.get("popis") || "").trim();
    const typPoskozeni = String(formData.get("typ_poskozeni") || "").trim();
    const priorita = String(formData.get("priorita") || "").trim();
    const blokujePouziti = formData.get("blokuje_pouziti") === "true";

    if (!skladovaPolozkaId) throw new Error("Chybí ID skladové položky.");
    if (!kusId) throw new Error("Vyber konkrétní kus.");

    const { error } = await supabase.from("hlaseni_poskozeni").insert({
      skladova_polozka_id: skladovaPolozkaId,
      kus_id: kusId,
      zakazka_id: null,
      pocet_kusu: 1,
      popis: popis || null,
      typ_poskozeni: typPoskozeni || null,
      priorita: priorita || "stredni",
      blokuje_pouziti: blokujePouziti,
      stav_reseni: "otevrene",
    });

    if (error) throw new Error(error.message);

    revalidatePath(`/sklad/${skladovaPolozkaId}`);
    revalidatePath("/sklad");
    revalidatePath("/sklad/sprava");
    revalidatePath("/sklad/poskozeni");
    revalidatePath("/sklad/statistika");
  }

  const [
    { data, error },
    { data: kategorieRaw, error: kategorieError },
    { data: podkategorieRaw, error: podkategorieError },
    { data: jednotkyRaw, error: jednotkyError },
  ] = await Promise.all([
    supabase.rpc("get_skladova_polozka_detail", {
      p_skladova_polozka_id: id,
    }),
    supabase.rpc("get_kategorie_techniky_full"),
    supabase.rpc("get_podkategorie_techniky_full"),
    supabase.rpc("get_jednotky_skladu_full"),
  ]);

  if (error) {
    return <SkladDetailLoadError message={error.message} />;
  }

  if (kategorieError || podkategorieError || jednotkyError) {
    return (
      <SkladDetailConfigError
        messages={[kategorieError?.message, podkategorieError?.message, jednotkyError?.message].filter(
          Boolean
        ) as string[]}
      />
    );
  }

  const row = ((data ?? [])[0] ?? null) as SkladDetailRow | null;

  if (!row) {
    return <SkladDetailNotFound />;
  }

  const kategorie = (kategorieRaw ?? []) as SkladKategorie[];
  const podkategorie = (podkategorieRaw ?? []) as SkladPodkategorie[];
  const jednotky = (jednotkyRaw ?? []) as SkladJednotka[];

  const [
    { data: kusyRaw, error: kusyError },
    { data: poskozeniRaw, error: poskozeniError },
    { data: typyRaw, error: typyError },
    { data: priorityRaw, error: priorityError },
  ] = await Promise.all([
    supabase
      .from("sklad_polozky_kusy")
      .select("kus_id, skladova_polozka_id, poradove_cislo, evidencni_cislo, stav, poznamka, aktivni")
      .eq("skladova_polozka_id", id)
      .order("poradove_cislo", { ascending: true }),
    supabase
      .from("hlaseni_poskozeni")
      .select(
        "poskozeni_id, skladova_polozka_id, kus_id, zakazka_id, pocet_kusu, popis, typ_poskozeni, priorita, blokuje_pouziti, stav_reseni, datum_nahlaseni, datum_uzavreni"
      )
      .eq("skladova_polozka_id", id)
      .order("datum_nahlaseni", { ascending: false }),
    supabase.rpc("get_typy_poskozeni_full"),
    supabase.rpc("get_priority_poskozeni_full"),
  ]);

  const kusy = (kusyRaw ?? []) as SkladKusRow[];
  const poskozeni = (poskozeniRaw ?? []) as SkladPoskozeniRow[];
  const typyPoskozeni = (typyRaw ?? []) as SkladTypPoskozeniOption[];
  const priority = (priorityRaw ?? []) as SkladPrioritaOption[];

  const evidovanyPocetKusu = kusy.length;
  const celkemKusu = computeCelkemKusu(evidovanyPocetKusu, row.celkem_k_dispozici);
  const poskozeneKusy = sumBlokujiciPoskozeneKusy(poskozeni);
  const pouzitelneKusy = computePouzitelneKusy(celkemKusu, poskozeneKusy);

  return (
    <div className="flex flex-col gap-5">
      <SkladDetailHeader
        skladovaPolozkaId={row.skladova_polozka_id}
        deleteAction={smazatPolozku}
      />

      <SkladDetailItemsTable
        row={row}
        kategorie={kategorie}
        podkategorie={podkategorie}
        jednotky={jednotky}
        celkemKusu={celkemKusu}
        poskozeneKusy={poskozeneKusy}
        pouzitelneKusy={pouzitelneKusy}
        kusy={kusy}
        poskozeni={poskozeni}
        kusyError={kusyError}
        updateAction={upravitPolozku}
        addKusAction={pridatKus}
        deleteKusAction={smazatKus}
      />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.3fr)_minmax(420px,0.9fr)]">
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <SkladDetailBasicInfo
              row={row}
              celkemKusu={celkemKusu}
              poskozeneKusy={poskozeneKusy}
              pouzitelneKusy={pouzitelneKusy}
            />
            <SkladDetailFinance row={row} />
          </div>

          <SkladDetailEvidenceSection
            poskozeni={poskozeni}
            priority={priority}
            jednotka={row.jednotka}
            poskozeniError={poskozeniError}
          />
        </div>

        <div className="flex flex-col gap-5">
          <SkladDetailReportDamageSection
            skladovaPolozkaId={row.skladova_polozka_id}
            kusy={kusy}
            typyPoskozeni={typyPoskozeni}
            priority={priority}
            typyError={typyError}
            priorityError={priorityError}
            reportAction={nahlasitPoskozeni}
          />

          <SkladDetailMetaSection row={row} />
        </div>
      </div>
    </div>
  );
}
