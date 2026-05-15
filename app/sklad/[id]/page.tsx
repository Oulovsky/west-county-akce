import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EvidencePoskozeniClient } from "@/components/sklad/evidence-poskozeni-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

type SkladDetailRow = {
  skladova_polozka_id: string;
  nazev: string;
  kategorie_techniky_id: string | null;
  kategorie_nazev: string | null;
  podkategorie_techniky_id: string | null;
  podkategorie_nazev: string | null;
  pozice: number | string | null;
  jednotka: string;
  celkem_k_dispozici: number | string;
  interni_naklad: number | string | null;
  fakturacni_cena: number | string | null;
  aktivni: boolean;
  poznamka: string | null;
  vytvoreno_dne: string;
  upraveno_dne: string;
};

type Kategorie = {
  kategorie_techniky_id: string;
  nazev: string;
  poradi?: number | null;
};

type Podkategorie = {
  podkategorie_techniky_id: string;
  kategorie_techniky_id: string;
  kategorie_nazev: string | null;
  nazev: string;
  poradi?: number | null;
};

type Jednotka = {
  jednotka_id: string;
  nazev: string;
  poradi?: number | null;
};

type KusRow = {
  kus_id: string;
  skladova_polozka_id: string;
  poradove_cislo: number;
  evidencni_cislo: string | null;
  stav: string;
  poznamka: string | null;
  aktivni: boolean;
};

type PoskozeniRow = {
  poskozeni_id: string;
  skladova_polozka_id: string;
  kus_id: string | null;
  zakazka_id: string | null;
  pocet_kusu: number | string;
  popis: string | null;
  typ_poskozeni: string | null;
  priorita: string | null;
  blokuje_pouziti: boolean;
  stav_reseni: string;
  datum_nahlaseni: string;
  datum_uzavreni: string | null;
};

type TypPoskozeniOption = {
  typ_id: string;
  nazev: string;
  poradi: number | null;
};

type PrioritaOption = {
  priorita_id: string;
  nazev: string;
  poradi: number | null;
};

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.NumberFormat("cs-CZ").format(parsed);
}

function formatMoney(value: number | string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";

  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function slugifyCz(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getKusLabel(kus: KusRow) {
  return kus.evidencni_cislo?.trim()
    ? kus.evidencni_cislo
    : `Kus #${kus.poradove_cislo}`;
}

function getKusStatus(kus: KusRow, poskozeni: PoskozeniRow[]) {
  const otevrene = poskozeni.filter(
    (p) => p.kus_id === kus.kus_id && !p.datum_uzavreni
  );

  const blokuje = otevrene.some((p) => p.blokuje_pouziti);

  if (blokuje) {
    return {
      text: "blokováno",
      className: "border-red-700 bg-red-950 text-red-200",
      blokovano: 1,
      pouzitelne: "✕",
    };
  }

  if (otevrene.length > 0) {
    return {
      text: "poškozeno, použitelné",
      className: "border-amber-700 bg-amber-950 text-amber-200",
      blokovano: 0,
      pouzitelne: "!",
    };
  }

  return {
    text: "OK",
    className: "border-emerald-700 bg-emerald-950 text-emerald-200",
    blokovano: 0,
    pouzitelne: "✓",
  };
}

function fieldClassName(extra = "") {
  return [
    "h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-semibold text-white outline-none",
    extra,
  ].join(" ");
}

function boxClassName(extra = "") {
  return [
    "flex h-12 w-full items-center rounded-xl border border-slate-700 bg-slate-950 px-3 font-semibold text-white",
    extra,
  ].join(" ");
}

function statusBoxClassName(extra = "") {
  return [
    "flex h-12 w-full items-center rounded-xl border px-3 font-semibold",
    extra,
  ].join(" ");
}

function headerBoxClassName(extra = "") {
  return [
    "flex h-10 w-full items-center rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold uppercase tracking-wide text-slate-300",
    extra,
  ].join(" ");
}

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
    return (
      <div className="rounded-2xl border border-red-800 bg-red-950/40 px-4 py-6 text-red-200">
        Chyba: {error.message}
      </div>
    );
  }

  if (kategorieError || podkategorieError || jednotkyError) {
    return (
      <div className="rounded-2xl border border-red-800 bg-red-950/40 px-4 py-6 text-red-200">
        Chyba konfigurace:{" "}
        {[kategorieError?.message, podkategorieError?.message, jednotkyError?.message]
          .filter(Boolean)
          .join(" | ")}
      </div>
    );
  }

  const row = ((data ?? [])[0] ?? null) as SkladDetailRow | null;

  if (!row) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Link
            href="/sklad"
            className="inline-flex items-center text-sm font-medium text-slate-300 transition hover:text-white"
          >
            ← Zpět na sklad
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-slate-200">
          Položka nenalezena.
        </div>
      </div>
    );
  }

  const kategorie = (kategorieRaw ?? []) as Kategorie[];
  const podkategorie = (podkategorieRaw ?? []) as Podkategorie[];
  const jednotky = (jednotkyRaw ?? []) as Jednotka[];

  const selectedKategorieId = row.kategorie_techniky_id ?? "";
  const selectedPodkategorie = podkategorie.filter(
    (item) => !selectedKategorieId || item.kategorie_techniky_id === selectedKategorieId
  );

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

  const kusy = (kusyRaw ?? []) as KusRow[];
  const poskozeni = (poskozeniRaw ?? []) as PoskozeniRow[];
  const typyPoskozeni = (typyRaw ?? []) as TypPoskozeniOption[];
  const priority = (priorityRaw ?? []) as PrioritaOption[];

  const evidovanyPocetKusu = kusy.length;
  const celkemKusu =
    evidovanyPocetKusu > 0
      ? evidovanyPocetKusu
      : toNumber(row.celkem_k_dispozici);

  const otevrenaBlokujiciPoskozeni = poskozeni.filter(
    (p) => !p.datum_uzavreni && p.blokuje_pouziti
  );

  const poskozeneKusy = otevrenaBlokujiciPoskozeni.reduce(
    (sum, item) => sum + toNumber(item.pocet_kusu),
    0
  );

  const pouzitelneKusy = Math.max(0, celkemKusu - poskozeneKusy);

  const tableMinWidth = "min-w-[1560px]";
  const tableGrid =
    "grid-cols-[minmax(360px,1.8fr)_150px_170px_90px_90px_110px_110px_90px_110px_110px_130px_130px]";

  const rowGridClassName = [
    "grid",
    tableGrid,
    "rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200",
  ].join(" ");

  const headerGridClassName = [
    "grid",
    tableGrid,
    "rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200",
  ].join(" ");

  const centerCellClassName = "flex items-center justify-center px-2";

  const editFormId = `upravit-polozku-${row.skladova_polozka_id}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/sklad"
          className="inline-flex items-center text-sm font-medium text-slate-300 transition hover:text-white"
        >
          ← Zpět na sklad
        </Link>

        <form action={smazatPolozku}>
          <input
            type="hidden"
            name="skladova_polozka_id"
            value={row.skladova_polozka_id}
          />
          <button
            type="submit"
            className="rounded-xl border border-red-700 bg-red-950 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-900"
          >
            Smazat hlavní položku
          </button>
        </form>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className={tableMinWidth}>
          <div className="bg-slate-950/30 px-3 pt-3">
            <div className={headerGridClassName}>
              <div className="flex items-center px-2">
                <span className={headerBoxClassName()}>Název</span>
              </div>

              <div className="flex items-center px-2">
                <span className={headerBoxClassName()}>Kategorie</span>
              </div>

              <div className="flex items-center px-2">
                <span className={headerBoxClassName()}>Podkategorie</span>
              </div>

              <div className={centerCellClassName}>
                <span className={headerBoxClassName("justify-center text-center")}>Pozice</span>
              </div>

              <div className={centerCellClassName}>
                <span className={headerBoxClassName("justify-center text-center")}>Celkem</span>
              </div>

              <div className={centerCellClassName}>
                <span className={headerBoxClassName("justify-center text-center")}>Blokováno</span>
              </div>

              <div className={centerCellClassName}>
                <span className={headerBoxClassName("justify-center text-center")}>Použitelné</span>
              </div>

              <div className={centerCellClassName}>
                <span className={headerBoxClassName("justify-center text-center")}>Jednotka</span>
              </div>

              <div className={centerCellClassName}>
                <span className={headerBoxClassName("justify-center text-center")}>Akce</span>
              </div>

              <div className={centerCellClassName}>
                <span className={headerBoxClassName("justify-center text-center")}>Rent</span>
              </div>

              <div className={centerCellClassName}>
                <span className={headerBoxClassName("justify-center text-center")}>Stav</span>
              </div>

              <div className={centerCellClassName}>
                <span className={headerBoxClassName("justify-center text-center")}>Akce</span>
              </div>
            </div>
          </div>

          <details className="group" open>
            <summary className="cursor-pointer list-none">
              <form
                id={editFormId}
                action={upravitPolozku}
                key={`${row.skladova_polozka_id}-${row.kategorie_techniky_id ?? "bez"}-${row.podkategorie_techniky_id ?? "bez"}-${row.pozice ?? "bez"}-${row.upraveno_dne}`}
              >
                <input
                  type="hidden"
                  name="skladova_polozka_id"
                  value={row.skladova_polozka_id}
                />
                <input
                  type="hidden"
                  name="celkem_k_dispozici"
                  value={celkemKusu}
                />
              </form>

              <div className="bg-slate-950/30 px-3 py-3">
                <div className={rowGridClassName}>
                  <div className="flex items-center px-2">
                    <input
                      form={editFormId}
                      name="nazev"
                      defaultValue={row.nazev}
                      className={fieldClassName()}
                    />
                  </div>

                  <div className="flex items-center px-2">
                    <select
                      form={editFormId}
                      name="kategorie_techniky_id"
                      defaultValue={selectedKategorieId}
                      className={fieldClassName()}
                    >
                      <option value="">Bez kategorie</option>
                      {kategorie.map((item) => (
                        <option
                          key={item.kategorie_techniky_id}
                          value={item.kategorie_techniky_id}
                        >
                          {item.nazev}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center px-2">
                    <select
                      form={editFormId}
                      name="podkategorie_techniky_id"
                      defaultValue={row.podkategorie_techniky_id ?? ""}
                      className={fieldClassName()}
                    >
                      <option value="">Bez podkategorie</option>
                      {selectedPodkategorie.map((item) => (
                        <option
                          key={item.podkategorie_techniky_id}
                          value={item.podkategorie_techniky_id}
                        >
                          {item.nazev}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={centerCellClassName}>
                    <input
                      form={editFormId}
                      name="pozice"
                      defaultValue={row.pozice ?? ""}
                      inputMode="decimal"
                      className={fieldClassName("text-center")}
                    />
                  </div>

                  <div className={centerCellClassName}>
                    <span className={boxClassName("justify-center text-center")}>
                      {formatNumber(celkemKusu)}
                    </span>
                  </div>

                  <div className={centerCellClassName}>
                    <span
                      className={statusBoxClassName(
                        [
                          "justify-center text-center",
                          poskozeneKusy > 0
                            ? "border-red-700 bg-red-950 text-red-200"
                            : "border-emerald-700 bg-emerald-950 text-emerald-200",
                        ].join(" ")
                      )}
                    >
                      {formatNumber(poskozeneKusy)}
                    </span>
                  </div>

                  <div className={centerCellClassName}>
                    <span className={statusBoxClassName("justify-center text-center border-emerald-700 bg-emerald-950 text-emerald-200")}>
                      {formatNumber(pouzitelneKusy)}
                    </span>
                  </div>

                  <div className={centerCellClassName}>
                    <select
                      form={editFormId}
                      name="jednotka"
                      defaultValue={row.jednotka}
                      className={fieldClassName("text-center")}
                    >
                      {jednotky.map((item) => (
                        <option key={item.jednotka_id} value={item.nazev}>
                          {item.nazev}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={centerCellClassName}>
                    <input
                      form={editFormId}
                      name="interni_naklad"
                      defaultValue={row.interni_naklad ?? ""}
                      inputMode="decimal"
                      className={fieldClassName("text-center")}
                    />
                  </div>

                  <div className={centerCellClassName}>
                    <input
                      form={editFormId}
                      name="fakturacni_cena"
                      defaultValue={row.fakturacni_cena ?? ""}
                      inputMode="decimal"
                      className={fieldClassName("text-center")}
                    />
                  </div>

                  <div className={centerCellClassName}>
                    <span
                      className={[
                        boxClassName("justify-center text-center"),
                        row.aktivni
                          ? "border-emerald-800 bg-emerald-950 text-emerald-100"
                          : "border-slate-700 bg-slate-950 text-slate-100",
                      ].join(" ")}
                    >
                      {row.aktivni ? "aktivní" : "neaktivní"}
                    </span>
                  </div>

                  <div className={centerCellClassName}>
                    <button
                      type="submit"
                      form={editFormId}
                      className="h-12 w-full rounded-xl border border-emerald-700 bg-emerald-900 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Uložit
                    </button>
                  </div>
                </div>
              </div>
            </summary>

            <div className="bg-slate-950/30 px-3 py-4">
              <div className="mb-3 flex justify-end">
                <form action={pridatKus}>
                  <input
                    type="hidden"
                    name="skladova_polozka_id"
                    value={row.skladova_polozka_id}
                  />
                  <input type="hidden" name="nazev" value={row.nazev} />
                  <button
                    type="submit"
                    className="rounded-xl border border-blue-700 bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                  >
                    + Přidat kus
                  </button>
                </form>
              </div>

              {kusyError ? (
                <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-4 text-sm text-red-200">
                  Chyba: {kusyError.message}
                </div>
              ) : kusy.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-4 py-8 text-center text-sm text-slate-400">
                  Pro tuto položku zatím nejsou založené jednotlivé kusy.
                </div>
              ) : (
                <div className="grid gap-2">
                  {kusy.map((kus) => {
                    const stav = getKusStatus(kus, poskozeni);

                    return (
                      <div key={kus.kus_id} className={rowGridClassName}>
                        <div className="flex items-center px-2">
                          <span className={boxClassName()}>
                            {getKusLabel(kus)}
                          </span>
                        </div>

                        <div className="flex items-center px-2">
                          <span className={boxClassName()}>{row.kategorie_nazev ?? "-"}</span>
                        </div>

                        <div className="flex items-center px-2">
                          <span className={boxClassName()}>{row.podkategorie_nazev ?? "-"}</span>
                        </div>

                        <div className={centerCellClassName}>
                          <span className={boxClassName("justify-center text-center")}>
                            {formatNumber(row.pozice)}
                          </span>
                        </div>

                        <div className={centerCellClassName}>
                          <span className={boxClassName("justify-center text-center")}>1</span>
                        </div>

                        <div className={centerCellClassName}>
                          <span
                            className={statusBoxClassName(
                              [
                                "justify-center text-center",
                                stav.blokovano
                                  ? "border-red-700 bg-red-950 text-red-200"
                                  : "border-emerald-700 bg-emerald-950 text-emerald-200",
                              ].join(" ")
                            )}
                          >
                            {stav.blokovano ? "1 ks" : "OK"}
                          </span>
                        </div>

                        <div className={centerCellClassName}>
                          <span
                            className={statusBoxClassName("justify-center text-center " + stav.className)}
                            title={stav.text}
                          >
                            {stav.pouzitelne}
                          </span>
                        </div>

                        <div className={centerCellClassName}>
                          <span className={boxClassName("justify-center text-center")}>{row.jednotka}</span>
                        </div>

                        <div className={centerCellClassName}>
                          <span className={boxClassName("justify-center text-center")}>
                            {formatMoney(row.interni_naklad)}
                          </span>
                        </div>

                        <div className={centerCellClassName}>
                          <span className={boxClassName("justify-center text-center")}>
                            {formatMoney(row.fakturacni_cena)}
                          </span>
                        </div>

                        <div className={centerCellClassName}>
                          <span
                            className={[
                              "flex h-12 w-full items-center justify-center rounded-xl border px-3 text-xs font-semibold text-center",
                              stav.className,
                            ].join(" ")}
                          >
                            {stav.text}
                          </span>
                        </div>

                        <div className={centerCellClassName}>
                          <form action={smazatKus} className="w-full">
                            <input
                              type="hidden"
                              name="skladova_polozka_id"
                              value={row.skladova_polozka_id}
                            />
                            <input type="hidden" name="kus_id" value={kus.kus_id} />
                            <button
                              type="submit"
                              className="h-12 w-full rounded-xl border border-red-800 bg-red-950 px-3 text-sm font-semibold text-red-100 transition hover:bg-red-900"
                            >
                              Smazat
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
        </div>
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.3fr)_minmax(420px,0.9fr)]">
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Základní info</h2>

              <div className="grid gap-3 text-sm text-slate-200">
                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Kategorie</div>
                  <div>{row.kategorie_nazev ?? "-"}</div>
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Podkategorie</div>
                  <div>{row.podkategorie_nazev ?? "-"}</div>
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Pozice</div>
                  <div>{formatNumber(row.pozice)}</div>
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Jednotka</div>
                  <div>{row.jednotka}</div>
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Na skladě celkem</div>
                  <div>
                    {formatNumber(celkemKusu)} {row.jednotka}
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Blokováno poškozením</div>
                  <div>
                    {formatNumber(poskozeneKusy)} {row.jednotka}
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Použitelné</div>
                  <div>
                    {formatNumber(pouzitelneKusy)} {row.jednotka}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Finance</h2>

              <div className="grid gap-3 text-sm text-slate-200">
                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Akce</div>
                  <div>{formatMoney(row.interni_naklad)}</div>
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Rent</div>
                  <div>{formatMoney(row.fakturacni_cena)}</div>
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Vytvořeno</div>
                  <div>{formatDateTime(row.vytvoreno_dne)}</div>
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="text-slate-500">Upraveno</div>
                  <div>{formatDateTime(row.upraveno_dne)}</div>
                </div>
              </div>
            </section>
          </div>

          <section
            id="evidence-poskozeni"
            className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Evidence poškození</h2>
                <p className="text-sm text-slate-400">
                  Filtrace přehledu poškození pro tuto položku.
                </p>
              </div>

              <Link
                href="/sklad/poskozeni"
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Centrální přehled poškození
              </Link>
            </div>

            {poskozeniError ? (
              <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-4 text-sm text-red-200">
                Chyba: {poskozeniError.message}
              </div>
            ) : (
              <EvidencePoskozeniClient
                poskozeni={poskozeni}
                priority={priority}
                jednotka={row.jednotka}
              />
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Nahlásit poškození
            </h2>

            {typyError || priorityError ? (
              <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-4 text-sm text-red-200">
                Chyba konfigurace poškození:{" "}
                {[typyError?.message, priorityError?.message].filter(Boolean).join(" | ")}
              </div>
            ) : (
              <form action={nahlasitPoskozeni} className="grid gap-4">
                <input type="hidden" name="skladova_polozka_id" value={row.skladova_polozka_id} />

                <div>
                  <div className="mb-2 text-sm text-slate-300">Konkrétní kus</div>
                  <select
                    name="kus_id"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
                  >
                    <option value="">Vyber kus</option>
                    {kusy.map((kus) => (
                      <option key={kus.kus_id} value={kus.kus_id}>
                        {getKusLabel(kus)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm text-slate-300">Typ poškození</div>
                    <select
                      name="typ_poskozeni"
                      defaultValue={slugifyCz(typyPoskozeni[0]?.nazev ?? "mechanické")}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
                    >
                      {typyPoskozeni.length > 0 ? (
                        typyPoskozeni.map((item) => (
                          <option key={item.typ_id} value={slugifyCz(item.nazev)}>
                            {item.nazev}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="mechanicke">mechanické</option>
                          <option value="elektricke">elektrické</option>
                          <option value="vizualni">vizuální</option>
                          <option value="jine">jiné</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-slate-300">Priorita</div>
                    <select
                      name="priorita"
                      defaultValue={slugifyCz(priority[1]?.nazev ?? priority[0]?.nazev ?? "střední")}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
                    >
                      {priority.length > 0 ? (
                        priority.map((item) => (
                          <option key={item.priorita_id} value={slugifyCz(item.nazev)}>
                            {item.nazev}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="nizka">nízká</option>
                          <option value="stredni">střední</option>
                          <option value="vysoka">vysoká</option>
                          <option value="kriticka">kritická</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <label className="inline-flex w-fit items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                  <input type="checkbox" name="blokuje_pouziti" value="true" defaultChecked className="h-4 w-4" />
                  <span>Blokuje použití</span>
                </label>

                <div>
                  <div className="mb-2 text-sm text-slate-300">Popis</div>
                  <textarea
                    name="popis"
                    rows={5}
                    placeholder="Co je poškozené, jak se to projevuje..."
                    className="min-h-[120px] w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl border border-amber-700 bg-amber-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
                  >
                    Nahlásit poškození
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Další</h2>

            <div className="grid gap-3 text-sm text-slate-200">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="text-slate-500">Poznámka</div>
                <div>{row.poznamka ?? "-"}</div>
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="text-slate-500">Vytvořeno</div>
                <div>{formatDateTime(row.vytvoreno_dne)}</div>
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="text-slate-500">Upraveno</div>
                <div>{formatDateTime(row.upraveno_dne)}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
