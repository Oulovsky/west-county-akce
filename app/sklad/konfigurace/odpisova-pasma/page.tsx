import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import type { SkladOdpisovePasmo } from "@/lib/sklad/types";

export const dynamic = "force-dynamic";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(formData: FormData, key: string, label: string) {
  const value = Number(textValue(formData, key).replace(",", "."));
  if (!Number.isFinite(value)) throw new Error(`${label} musí být číslo.`);
  return value;
}

async function createDepreciationBandAction(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const nazev = textValue(formData, "nazev");
  const pocetMesicu = numberValue(formData, "pocet_mesicu", "Počet měsíců");
  const poradi = numberValue(formData, "poradi", "Pořadí");

  if (!nazev) throw new Error("Název odpisového pásma je povinný.");
  if (!Number.isInteger(pocetMesicu) || pocetMesicu <= 0) {
    throw new Error("Počet měsíců musí být celé číslo větší než 0.");
  }
  if (!Number.isInteger(poradi)) throw new Error("Pořadí musí být celé číslo.");

  const { error } = await supabase.from(SKLAD_TABLE.odpisovaPasma).insert({
    nazev,
    pocet_mesicu: pocetMesicu,
    poradi,
    aktivni: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/sklad/konfigurace/odpisova-pasma");
}

async function updateDepreciationBandAction(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const id = textValue(formData, "odpisove_pasmo_id");
  const nazev = textValue(formData, "nazev");
  const pocetMesicu = numberValue(formData, "pocet_mesicu", "Počet měsíců");
  const poradi = numberValue(formData, "poradi", "Pořadí");
  const aktivni = formData.get("aktivni") === "on";

  if (!id) throw new Error("Chybí ID odpisového pásma.");
  if (!nazev) throw new Error("Název odpisového pásma je povinný.");
  if (!Number.isInteger(pocetMesicu) || pocetMesicu <= 0) {
    throw new Error("Počet měsíců musí být celé číslo větší než 0.");
  }
  if (!Number.isInteger(poradi)) throw new Error("Pořadí musí být celé číslo.");

  const { error } = await supabase
    .from(SKLAD_TABLE.odpisovaPasma)
    .update({
      nazev,
      pocet_mesicu: pocetMesicu,
      poradi,
      aktivni,
      updated_at: new Date().toISOString(),
    })
    .eq("odpisove_pasmo_id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/sklad/konfigurace/odpisova-pasma");
  revalidatePath("/sklad/sprava");
}

export default async function SkladOdpisovaPasmaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(SKLAD_TABLE.odpisovaPasma)
    .select("odpisove_pasmo_id, nazev, pocet_mesicu, aktivni, poradi")
    .order("poradi", { ascending: true })
    .order("nazev", { ascending: true });

  const bands = (data ?? []) as SkladOdpisovePasmo[];

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-7 text-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Odpisová pásma</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Interní evidence pro výpočet současné provozní hodnoty konkrétních kusů techniky.
            Neovlivňuje cenu pro akce, klientskou fakturaci ani objednávky.
          </p>
        </div>
        <Link
          href="/sklad/konfigurace"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-semibold text-white"
        >
          Zpět na konfiguraci
        </Link>
      </div>

      <Card>
        <h2 className="text-lg font-bold text-white">Přidat pásmo</h2>
        <form action={createDepreciationBandAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_120px_auto]">
          <Input name="nazev" placeholder="Např. 3 roky" required />
          <Input name="pocet_mesicu" type="number" min={1} step={1} placeholder="Měsíce" required />
          <Input name="poradi" type="number" step={1} defaultValue="100" placeholder="Pořadí" required />
          <Button type="submit">Přidat</Button>
        </form>
      </Card>

      {error ? (
        <Card className="border-red-500/40 bg-red-950/20 text-red-100">
          Odpisová pásma se nepodařilo načíst: {error.message}
        </Card>
      ) : (
        <div className="space-y-3">
          {bands.map((band) => (
            <Card key={band.odpisove_pasmo_id}>
              <form action={updateDepreciationBandAction} className="grid gap-3 md:grid-cols-[1fr_140px_120px_110px_auto] md:items-end">
                <input type="hidden" name="odpisove_pasmo_id" value={band.odpisove_pasmo_id} />
                <label className="block">
                  <span className="text-sm font-semibold text-slate-200">Název</span>
                  <Input name="nazev" defaultValue={band.nazev} required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-200">Měsíců</span>
                  <Input name="pocet_mesicu" type="number" min={1} step={1} defaultValue={String(band.pocet_mesicu)} required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-200">Pořadí</span>
                  <Input name="poradi" type="number" step={1} defaultValue={String(band.poradi ?? 0)} required />
                </label>
                <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-200">
                  <input name="aktivni" type="checkbox" defaultChecked={band.aktivni} />
                  Aktivní
                </label>
                <Button type="submit">Uložit</Button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
