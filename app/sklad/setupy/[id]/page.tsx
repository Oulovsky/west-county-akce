import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

type SetupRow = {
  setup_id: string;
  nazev: string;
  popis: string | null;
  aktivni: boolean;
  poradi: number | null;
};

type SetupPolozkaRow = {
  setup_polozka_id: string;
  setup_id: string;
  skladova_polozka_id: string;
  mnozstvi: number | string;
  poznamka: string | null;
  poradi: number | null;
};

type SkladPolozkaRow = {
  skladova_polozka_id: string;
  nazev: string;
  pozice: number | string | null;
  jednotka: string | null;
  aktivni: boolean | null;
  sklad_blok_id: string | null;
  kategorie_techniky_id: string | null;
  podkategorie_techniky_id: string | null;
};

type SkladBlokRow = {
  sklad_blok_id: string;
  nazev: string;
  poradi: number | null;
};

type KategorieRow = {
  kategorie_techniky_id: string;
  nazev: string;
  poradi: number | null;
};

type PodkategorieRow = {
  podkategorie_techniky_id: string;
  nazev: string;
  poradi: number | null;
};

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(
    toNumber(value)
  );
}

function formatText(value: string | number | null | undefined) {
  const text = String(value ?? "").trim();
  return text || "—";
}

export default async function SkladSetupDetailPage({ params }: PageProps) {
  const { id } = await params;

  async function updateSetup(formData: FormData) {
    "use server";

    const setupId = String(formData.get("setup_id") ?? "").trim();
    const nazev = String(formData.get("nazev") ?? "").trim();
    const popis = String(formData.get("popis") ?? "").trim();
    const poradi = Number(formData.get("poradi") ?? 0);

    if (!setupId) throw new Error("Chybí setup_id.");
    if (!nazev) throw new Error("Název setupu je povinný.");
    if (!Number.isFinite(poradi)) throw new Error("Pořadí musí být číslo.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("setupy")
      .update({ nazev, popis: popis || null, poradi })
      .eq("setup_id", setupId);

    if (error) throw new Error(error.message);

    revalidatePath("/sklad/setupy");
    revalidatePath(`/sklad/setupy/${setupId}`);
  }

  async function toggleSetup(formData: FormData) {
    "use server";

    const setupId = String(formData.get("setup_id") ?? "").trim();
    const aktivni = String(formData.get("aktivni") ?? "") === "true";
    if (!setupId) throw new Error("Chybí setup_id.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("setupy")
      .update({ aktivni })
      .eq("setup_id", setupId);

    if (error) throw new Error(error.message);

    revalidatePath("/sklad/setupy");
    revalidatePath(`/sklad/setupy/${setupId}`);
  }

  async function addSetupPolozka(formData: FormData) {
    "use server";

    const setupId = String(formData.get("setup_id") ?? "").trim();
    const skladovaPolozkaId = String(formData.get("skladova_polozka_id") ?? "").trim();
    const mnozstvi = Number(formData.get("mnozstvi") ?? 1);
    const poznamka = String(formData.get("poznamka") ?? "").trim();
    const poradi = Number(formData.get("poradi") ?? 0);

    if (!setupId) throw new Error("Chybí setup_id.");
    if (!skladovaPolozkaId) throw new Error("Vyber skladovou položku.");
    if (!Number.isFinite(mnozstvi) || mnozstvi <= 0) {
      throw new Error("Množství musí být větší než 0.");
    }
    if (!Number.isFinite(poradi)) throw new Error("Pořadí musí být číslo.");

    const supabase = await createClient();
    const { error } = await supabase.from("setup_polozky").upsert(
      {
        setup_id: setupId,
        skladova_polozka_id: skladovaPolozkaId,
        mnozstvi,
        poznamka: poznamka || null,
        poradi,
      },
      { onConflict: "setup_id,skladova_polozka_id" }
    );

    if (error) throw new Error(error.message);

    revalidatePath("/sklad/setupy");
    revalidatePath(`/sklad/setupy/${setupId}`);
  }

  async function updateSetupPolozka(formData: FormData) {
    "use server";

    const setupId = String(formData.get("setup_id") ?? "").trim();
    const setupPolozkaId = String(formData.get("setup_polozka_id") ?? "").trim();
    const mnozstvi = Number(formData.get("mnozstvi") ?? 1);
    const poznamka = String(formData.get("poznamka") ?? "").trim();
    const poradi = Number(formData.get("poradi") ?? 0);

    if (!setupId) throw new Error("Chybí setup_id.");
    if (!setupPolozkaId) throw new Error("Chybí setup_polozka_id.");
    if (!Number.isFinite(mnozstvi) || mnozstvi <= 0) {
      throw new Error("Množství musí být větší než 0.");
    }
    if (!Number.isFinite(poradi)) throw new Error("Pořadí musí být číslo.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("setup_polozky")
      .update({
        mnozstvi,
        poznamka: poznamka || null,
        poradi,
      })
      .eq("setup_polozka_id", setupPolozkaId)
      .eq("setup_id", setupId);

    if (error) throw new Error(error.message);

    revalidatePath("/sklad/setupy");
    revalidatePath(`/sklad/setupy/${setupId}`);
  }

  async function removeSetupPolozka(formData: FormData) {
    "use server";

    const setupId = String(formData.get("setup_id") ?? "").trim();
    const setupPolozkaId = String(formData.get("setup_polozka_id") ?? "").trim();

    if (!setupId) throw new Error("Chybí setup_id.");
    if (!setupPolozkaId) throw new Error("Chybí setup_polozka_id.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("setup_polozky")
      .delete()
      .eq("setup_polozka_id", setupPolozkaId)
      .eq("setup_id", setupId);

    if (error) throw new Error(error.message);

    revalidatePath("/sklad/setupy");
    revalidatePath(`/sklad/setupy/${setupId}`);
  }

  const supabase = await createClient();
  const [
    { data: setupRaw, error: setupError },
    { data: setupPolozkyRaw, error: setupPolozkyError },
    { data: skladRaw, error: skladError },
    { data: blokyRaw, error: blokyError },
    { data: kategorieRaw, error: kategorieError },
    { data: podkategorieRaw, error: podkategorieError },
  ] = await Promise.all([
    supabase
      .from("setupy")
      .select("setup_id, nazev, popis, aktivni, poradi")
      .eq("setup_id", id)
      .maybeSingle(),
    supabase
      .from("setup_polozky")
      .select("setup_polozka_id, setup_id, skladova_polozka_id, mnozstvi, poznamka, poradi")
      .eq("setup_id", id)
      .order("poradi", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("skladove_polozky")
      .select(
        "skladova_polozka_id, nazev, pozice, jednotka, aktivni, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id"
      )
      .order("nazev", { ascending: true }),
    supabase
      .from("sklad_bloky")
      .select("sklad_blok_id, nazev, poradi")
      .order("poradi", { ascending: true }),
    supabase
      .from("kategorie_techniky")
      .select("kategorie_techniky_id, nazev, poradi")
      .order("poradi", { ascending: true }),
    supabase
      .from("podkategorie_techniky")
      .select("podkategorie_techniky_id, nazev, poradi")
      .order("poradi", { ascending: true }),
  ]);

  if (setupError) return <div>Chyba setupu: {setupError.message}</div>;
  if (setupPolozkyError) return <div>Chyba položek setupu: {setupPolozkyError.message}</div>;
  if (skladError) return <div>Chyba skladu: {skladError.message}</div>;
  if (blokyError) return <div>Chyba okruhů: {blokyError.message}</div>;
  if (kategorieError) return <div>Chyba kategorií: {kategorieError.message}</div>;
  if (podkategorieError) return <div>Chyba podkategorií: {podkategorieError.message}</div>;

  const setup = (setupRaw ?? null) as SetupRow | null;
  if (!setup) {
    return (
      <div className="page-shell w-full">
        <Card>
          <h1 className="text-xl font-black text-white">Setup nenalezen</h1>
          <Link
            href="/sklad/setupy"
            className="mt-4 inline-flex rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-white"
          >
            Zpět na setupy
          </Link>
        </Card>
      </div>
    );
  }

  const setupPolozky = (setupPolozkyRaw ?? []) as SetupPolozkaRow[];
  const sklad = ((skladRaw ?? []) as SkladPolozkaRow[]).filter((item) => item.aktivni !== false);
  const blokMap = new Map(
    ((blokyRaw ?? []) as SkladBlokRow[]).map((row) => [row.sklad_blok_id, row])
  );
  const kategorieMap = new Map(
    ((kategorieRaw ?? []) as KategorieRow[]).map((row) => [row.kategorie_techniky_id, row])
  );
  const podkategorieMap = new Map(
    ((podkategorieRaw ?? []) as PodkategorieRow[]).map((row) => [
      row.podkategorie_techniky_id,
      row,
    ])
  );
  const skladMap = new Map(sklad.map((item) => [item.skladova_polozka_id, item]));
  const usedIds = new Set(setupPolozky.map((item) => item.skladova_polozka_id));
  const sortedSklad = [...sklad].sort((a, b) => {
    const aBlok = a.sklad_blok_id ? (blokMap.get(a.sklad_blok_id)?.poradi ?? 999999) : 999999;
    const bBlok = b.sklad_blok_id ? (blokMap.get(b.sklad_blok_id)?.poradi ?? 999999) : 999999;
    if (aBlok !== bBlok) return aBlok - bBlok;
    return a.nazev.localeCompare(b.nazev, "cs");
  });

  function itemMeta(item: SkladPolozkaRow | null | undefined) {
    if (!item) {
      return {
        okruh: "—",
        kategorie: "—",
        podkategorie: "—",
        pozice: "—",
      };
    }

    return {
      okruh: item.sklad_blok_id ? (blokMap.get(item.sklad_blok_id)?.nazev ?? "—") : "—",
      kategorie: item.kategorie_techniky_id
        ? (kategorieMap.get(item.kategorie_techniky_id)?.nazev ?? "—")
        : "—",
      podkategorie: item.podkategorie_techniky_id
        ? (podkategorieMap.get(item.podkategorie_techniky_id)?.nazev ?? "—")
        : "—",
      pozice: formatText(item.pozice),
    };
  }

  return (
    <div className="page-shell w-full">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/sklad/setupy" className="text-sm font-semibold text-slate-400 hover:text-white">
            ← Setupy skladu
          </Link>
          <h1 className="mt-2 text-3xl font-black text-white">{setup.nazev}</h1>
          <p className="mt-2 text-sm text-slate-400">
            Setup obsahuje pouze skladové položky a množství. Žádné konkrétní kusy.
          </p>
        </div>
        <Badge variant={setup.aktivni ? "success" : "warning"}>
          {setup.aktivni ? "Aktivní" : "Neaktivní"}
        </Badge>
      </div>

      <Card>
        <h2 className="text-xl font-black text-white">Základ setupu</h2>
        <form action={updateSetup} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_120px_auto]">
          <input type="hidden" name="setup_id" value={setup.setup_id} />
          <input
            name="nazev"
            defaultValue={setup.nazev}
            required
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-bold text-white outline-none focus:border-blue-500"
          />
          <input
            name="popis"
            defaultValue={setup.popis ?? ""}
            placeholder="Popis"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
          />
          <input
            name="poradi"
            type="number"
            step="1"
            defaultValue={setup.poradi ?? 0}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
          >
            Uložit
          </button>
        </form>
        <form action={toggleSetup} className="mt-3">
          <input type="hidden" name="setup_id" value={setup.setup_id} />
          <input type="hidden" name="aktivni" value={setup.aktivni ? "false" : "true"} />
          <button
            type="submit"
            className="rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          >
            {setup.aktivni ? "Deaktivovat setup" : "Aktivovat setup"}
          </button>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl font-black text-white">Položky v setupu</h2>
        <div className="mt-4 grid gap-3">
          {setupPolozky.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-400">
              Setup zatím neobsahuje žádné položky.
            </div>
          ) : (
            setupPolozky.map((setupItem) => {
              const item = skladMap.get(setupItem.skladova_polozka_id);
              const meta = itemMeta(item);

              return (
                <section
                  key={setupItem.setup_polozka_id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-xl font-black text-white">
                        {item?.nazev ?? setupItem.skladova_polozka_id}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                        <span className="rounded-md bg-slate-800 px-2 py-1">Okruh: {meta.okruh}</span>
                        <span className="rounded-md bg-slate-800 px-2 py-1">Kategorie: {meta.kategorie}</span>
                        <span className="rounded-md bg-slate-800 px-2 py-1">Podkategorie: {meta.podkategorie}</span>
                        <span className="rounded-md bg-emerald-950 px-2 py-1 text-emerald-100">
                          Pozice: {meta.pozice}
                        </span>
                      </div>
                    </div>
                    <form action={removeSetupPolozka}>
                      <input type="hidden" name="setup_id" value={setup.setup_id} />
                      <input
                        type="hidden"
                        name="setup_polozka_id"
                        value={setupItem.setup_polozka_id}
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-900"
                      >
                        Odebrat
                      </button>
                    </form>
                  </div>

                  <form
                    action={updateSetupPolozka}
                    className="mt-4 grid gap-3 lg:grid-cols-[140px_120px_1fr_auto]"
                  >
                    <input type="hidden" name="setup_id" value={setup.setup_id} />
                    <input
                      type="hidden"
                      name="setup_polozka_id"
                      value={setupItem.setup_polozka_id}
                    />
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Množství
                      <input
                        name="mnozstvi"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={String(setupItem.mnozstvi)}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base normal-case text-white outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Pořadí
                      <input
                        name="poradi"
                        type="number"
                        step="1"
                        defaultValue={setupItem.poradi ?? 0}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base normal-case text-white outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Poznámka
                      <input
                        name="poznamka"
                        defaultValue={setupItem.poznamka ?? ""}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base normal-case text-white outline-none focus:border-blue-500"
                      />
                    </label>
                    <button
                      type="submit"
                      className="self-end rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
                    >
                      Uložit položku
                    </button>
                  </form>
                </section>
              );
            })
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl font-black text-white">Přidat skladovou položku</h2>
        <p className="mt-1 text-sm text-slate-400">
          Přidáváš typ položky a množství, ne konkrétní kus.
        </p>
        <div className="mt-4 grid gap-3">
          {sortedSklad.map((item) => {
            const meta = itemMeta(item);
            const alreadyUsed = usedIds.has(item.skladova_polozka_id);

            return (
              <section
                key={item.skladova_polozka_id}
                className={[
                  "rounded-2xl border p-4",
                  alreadyUsed
                    ? "border-blue-800 bg-blue-950/30"
                    : "border-slate-800 bg-slate-950/60",
                ].join(" ")}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-lg font-black text-white">{item.nazev}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                      <span className="rounded-md bg-slate-800 px-2 py-1">Okruh: {meta.okruh}</span>
                      <span className="rounded-md bg-slate-800 px-2 py-1">Kategorie: {meta.kategorie}</span>
                      <span className="rounded-md bg-slate-800 px-2 py-1">Podkategorie: {meta.podkategorie}</span>
                      <span className="rounded-md bg-emerald-950 px-2 py-1 text-emerald-100">
                        Pozice: {meta.pozice}
                      </span>
                    </div>
                  </div>
                  {alreadyUsed ? <Badge variant="default">Už v setupu</Badge> : null}
                </div>

                <form
                  action={addSetupPolozka}
                  className="mt-4 grid gap-3 lg:grid-cols-[140px_120px_1fr_auto]"
                >
                  <input type="hidden" name="setup_id" value={setup.setup_id} />
                  <input
                    type="hidden"
                    name="skladova_polozka_id"
                    value={item.skladova_polozka_id}
                  />
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Množství
                    <input
                      name="mnozstvi"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue="1"
                      className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base normal-case text-white outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Pořadí
                    <input
                      name="poradi"
                      type="number"
                      step="1"
                      defaultValue="0"
                      className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base normal-case text-white outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Poznámka
                    <input
                      name="poznamka"
                      placeholder="Volitelně"
                      className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base normal-case text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                    />
                  </label>
                  <button
                    type="submit"
                    className="self-end rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                  >
                    {alreadyUsed ? "Přepsat v setupu" : "Přidat"}
                  </button>
                </form>
              </section>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
