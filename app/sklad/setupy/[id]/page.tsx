import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  assertInternalWriteAccess,
  loadSessionRolePermissions,
} from "@/lib/auth/internal-role-access-server";
import { createClient } from "@/lib/supabase/server";
import { SetupContentSummary, type SetupContentItem } from "../components/SetupContentSummary";
import { SetupDetailCatalog } from "../components/SetupDetailCatalog";

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
};

type SkladPolozkaRow = {
  skladova_polozka_id: string;
  nazev: string;
  jednotka: string | null;
  sklad_blok_id: string | null;
  kategorie_techniky_id: string | null;
};

type SkladBlokRow = {
  sklad_blok_id: string;
  nazev: string;
};

type KategorieRow = {
  kategorie_techniky_id: string;
  nazev: string;
};

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
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
    await assertInternalWriteAccess(supabase);
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

  const [
    { data: setupRaw, error: setupError },
    { data: setupPolozkyRaw, error: setupPolozkyError },
    { data: skladRaw, error: skladError },
    { data: blokyRaw, error: blokyError },
    { data: kategorieRaw, error: kategorieError },
  ] = await Promise.all([
    supabase
      .from("setupy")
      .select("setup_id, nazev, popis, aktivni, poradi")
      .eq("setup_id", id)
      .maybeSingle(),
    supabase
      .from("setup_polozky")
      .select("setup_polozka_id, setup_id, skladova_polozka_id, mnozstvi")
      .eq("setup_id", id)
      .order("poradi", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("skladove_polozky")
      .select(
        "skladova_polozka_id, nazev, jednotka, sklad_blok_id, kategorie_techniky_id"
      ),
    supabase.from("sklad_bloky").select("sklad_blok_id, nazev"),
    supabase.from("kategorie_techniky").select("kategorie_techniky_id, nazev"),
  ]);

  if (setupError) return <div>Chyba setupu: {setupError.message}</div>;
  if (setupPolozkyError) {
    return <div>Chyba položek setupu: {setupPolozkyError.message}</div>;
  }
  if (skladError) return <div>Chyba skladu: {skladError.message}</div>;
  if (blokyError) return <div>Chyba okruhů: {blokyError.message}</div>;
  if (kategorieError) return <div>Chyba kategorií: {kategorieError.message}</div>;

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
  const skladMap = new Map(
    ((skladRaw ?? []) as SkladPolozkaRow[]).map((row) => [row.skladova_polozka_id, row])
  );
  const blokMap = new Map(
    ((blokyRaw ?? []) as SkladBlokRow[]).map((row) => [row.sklad_blok_id, row.nazev])
  );
  const kategorieMap = new Map(
    ((kategorieRaw ?? []) as KategorieRow[]).map((row) => [
      row.kategorie_techniky_id,
      row.nazev,
    ])
  );

  const contentItems: SetupContentItem[] = setupPolozky.map((row) => {
    const polozka = skladMap.get(row.skladova_polozka_id);
    return {
      setupPolozkaId: row.setup_polozka_id,
      skladovaPolozkaId: row.skladova_polozka_id,
      nazev: polozka?.nazev ?? row.skladova_polozka_id,
      mnozstvi: toNumber(row.mnozstvi),
      okruh: polozka?.sklad_blok_id
        ? (blokMap.get(polozka.sklad_blok_id) ?? "—")
        : "—",
      kategorie: polozka?.kategorie_techniky_id
        ? (kategorieMap.get(polozka.kategorie_techniky_id) ?? "—")
        : "—",
      jednotka: polozka?.jednotka?.trim() || "ks",
    };
  });

  return (
    <div className="page-shell w-full">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/sklad/setupy"
            className="text-sm font-semibold text-slate-400 hover:text-white"
          >
            ← Setupy skladu
          </Link>
          <h1 className="mt-2 text-3xl font-black text-white">{setup.nazev}</h1>
          <p className="mt-2 text-sm text-slate-400">
            Vyber položky ve skladovém stromu a přidej je do setupu jedním tlačítkem.
          </p>
        </div>
        <Badge variant={setup.aktivni ? "success" : "warning"}>
          {setup.aktivni ? "Aktivní" : "Neaktivní"}
        </Badge>
      </div>

      {readOnly ? (
        <p className="mb-4 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
          Režim pouze pro čtení — úpravy setupů nejsou dostupné.
        </p>
      ) : null}

      <Card>
        <h2 className="text-xl font-black text-white">Základ setupu</h2>
        {readOnly ? (
          <div className="mt-4 space-y-2">
            <p className="font-bold text-white">{setup.nazev}</p>
            {setup.popis ? <p className="text-sm text-slate-400">{setup.popis}</p> : null}
          </div>
        ) : (
          <>
            <form
              action={updateSetup}
              className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_120px_auto]"
            >
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
          </>
        )}
      </Card>

      <div className="mt-6">
        <SetupContentSummary
          setupId={setup.setup_id}
          items={contentItems}
          readOnly={readOnly}
        />
      </div>

      {readOnly ? null : (
        <div className="mt-6">
          <SetupDetailCatalog setupId={setup.setup_id} />
        </div>
      )}
    </div>
  );
}
