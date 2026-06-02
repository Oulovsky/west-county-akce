import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  assertInternalWriteAccess,
  loadSessionRolePermissions,
} from "@/lib/auth/internal-role-access-server";
import { createClient } from "@/lib/supabase/server";

type SetupRow = {
  setup_id: string;
  nazev: string;
  popis: string | null;
  aktivni: boolean;
  poradi: number | null;
  created_at: string;
};

type SetupPolozkaCountRow = {
  setup_id: string;
  mnozstvi: number | string;
};

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value);
}

export default async function SkladSetupyPage() {
  async function createSetup(formData: FormData) {
    "use server";

    const nazev = String(formData.get("nazev") ?? "").trim();
    const popis = String(formData.get("popis") ?? "").trim();
    const poradi = Number(formData.get("poradi") ?? 0);

    if (!nazev) throw new Error("Název setupu je povinný.");
    if (!Number.isFinite(poradi)) throw new Error("Pořadí musí být číslo.");

    const supabase = await createClient();
    await assertInternalWriteAccess(supabase);
    const { data, error } = await supabase
      .from("setupy")
      .insert({
        nazev,
        popis: popis || null,
        poradi,
      })
      .select("setup_id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/sklad/setupy");
    redirect(`/sklad/setupy/${data.setup_id}`);
  }

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
    await assertInternalWriteAccess(supabase);
    const { error } = await supabase
      .from("setupy")
      .update({
        nazev,
        popis: popis || null,
        poradi,
      })
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
    await assertInternalWriteAccess(supabase);
    const { error } = await supabase
      .from("setupy")
      .update({ aktivni })
      .eq("setup_id", setupId);

    if (error) throw new Error(error.message);

    revalidatePath("/sklad/setupy");
    revalidatePath(`/sklad/setupy/${setupId}`);
  }

  const supabase = await createClient();
  const { perms } = await loadSessionRolePermissions(supabase);
  const readOnly = !perms.skladEditace;

  const [{ data: setupyRaw, error: setupyError }, { data: polozkyRaw, error: polozkyError }] =
    await Promise.all([
      supabase
        .from("setupy")
        .select("setup_id, nazev, popis, aktivni, poradi, created_at")
        .order("aktivni", { ascending: false })
        .order("poradi", { ascending: true })
        .order("nazev", { ascending: true }),
      supabase.from("setup_polozky").select("setup_id, mnozstvi"),
    ]);

  if (setupyError) return <div>Chyba setupů: {setupyError.message}</div>;
  if (polozkyError) return <div>Chyba položek setupů: {polozkyError.message}</div>;

  const setupy = (setupyRaw ?? []) as SetupRow[];
  const polozky = (polozkyRaw ?? []) as SetupPolozkaCountRow[];
  const counts = new Map<string, { pocetPolozek: number; celkemKusu: number }>();

  for (const row of polozky) {
    const current = counts.get(row.setup_id) ?? { pocetPolozek: 0, celkemKusu: 0 };
    current.pocetPolozek += 1;
    current.celkemKusu += toNumber(row.mnozstvi);
    counts.set(row.setup_id, current);
  }

  return (
    <div className="page-shell w-full">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sklad
          </div>
          <h1 className="mt-1 text-3xl font-black text-white">Setupy skladu</h1>
          <p className="mt-2 text-sm text-slate-400">
            Knihovna opakovatelných sestav z položek skladu. Setupy neobsahují konkrétní kusy.
          </p>
        </div>
        <Link
          href="/sklad/sprava"
          className="inline-flex rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
        >
          Zpět do skladu
        </Link>
      </div>

      {readOnly ? (
        <p className="mb-4 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
          Režim pouze pro čtení — úpravy setupů nejsou dostupné.
        </p>
      ) : null}

      {readOnly ? null : (
      <Card>
        <h2 className="text-xl font-black text-white">Nový setup</h2>
        <form action={createSetup} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_120px_auto]">
          <input
            name="nazev"
            placeholder="Stage 10x8"
            required
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
          />
          <input
            name="popis"
            placeholder="Volitelný popis"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
          />
          <input
            name="poradi"
            type="number"
            step="1"
            defaultValue="0"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="rounded-xl border border-blue-600 bg-blue-600 px-5 py-3 font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500"
          >
            Vytvořit
          </button>
        </form>
      </Card>
      )}

      <div className="mt-6 grid gap-4">
        {setupy.length === 0 ? (
          <Card>
            <div className="text-sm text-slate-400">Zatím nejsou vytvořené žádné setupy.</div>
          </Card>
        ) : (
          setupy.map((setup) => {
            const count = counts.get(setup.setup_id) ?? { pocetPolozek: 0, celkemKusu: 0 };

            return (
              <Card key={setup.setup_id} className="border-slate-800 bg-[#081225]">
                <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={setup.aktivni ? "success" : "warning"}>
                        {setup.aktivni ? "Aktivní" : "Neaktivní"}
                      </Badge>
                      <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300">
                        položek: {count.pocetPolozek}
                      </span>
                      <span className="rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300">
                        kusů: {formatNumber(count.celkemKusu)}
                      </span>
                    </div>

                    {readOnly ? (
                      <div className="mt-4 space-y-2">
                        <h3 className="text-lg font-bold text-white">{setup.nazev}</h3>
                        {setup.popis ? (
                          <p className="text-sm text-slate-400">{setup.popis}</p>
                        ) : null}
                      </div>
                    ) : (
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
                    )}

                  </div>

                  <div className="flex flex-col gap-3">
                    <Link
                      href={`/sklad/setupy/${setup.setup_id}`}
                      className="flex min-h-12 items-center justify-center rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                    >
                      Otevřít detail
                    </Link>
                    {readOnly ? null : (
                    <form action={toggleSetup}>
                      <input type="hidden" name="setup_id" value={setup.setup_id} />
                      <input
                        type="hidden"
                        name="aktivni"
                        value={setup.aktivni ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                      >
                        {setup.aktivni ? "Deaktivovat" : "Aktivovat"}
                      </button>
                    </form>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
