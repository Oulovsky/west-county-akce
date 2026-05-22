import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { verifyAppAdminOrSefPage } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";
import { createVehicleAction, deactivateVehicleAction, updateVehicleAction } from "./actions";

type VehicleRow = {
  id: string;
  nazev: string;
  spz: string | null;
  typ: string | null;
  aktivni: boolean | null;
  kapacita_osob: number | string | null;
  kapacita_poznamka: string | null;
  poznamka: string | null;
};

function VehicleFields({
  vehicle,
}: {
  vehicle?: Partial<VehicleRow>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Název">
        <Input name="nazev" defaultValue={vehicle?.nazev ?? ""} required />
      </Field>
      <Field label="SPZ">
        <Input name="spz" defaultValue={vehicle?.spz ?? ""} />
      </Field>
      <Field label="Kapacita osob">
        <Input name="kapacita_osob" type="number" min="0" defaultValue={vehicle?.kapacita_osob ?? ""} />
      </Field>
      <Field label="Kapacita poznámka">
        <Input name="kapacita_poznamka" defaultValue={vehicle?.kapacita_poznamka ?? ""} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Poznámka">
          <Textarea name="poznamka" rows={2} defaultValue={vehicle?.poznamka ?? ""} />
        </Field>
      </div>
    </div>
  );
}

export default async function VehiclesAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <div className="p-6 text-red-300">Unauthorized</div>;

  const access = await verifyAppAdminOrSefPage(supabase);
  if (!access.ok) {
    return <div className="p-6 text-red-300">{access.message}</div>;
  }

  const { data: vehiclesRaw, error: vehiclesError } = await supabase
    .from("vozidla")
    .select("*")
    .eq("typ", "firemni")
    .order("aktivni", { ascending: false })
    .order("nazev");

  if (vehiclesError) return <div className="p-6 text-red-300">{vehiclesError.message}</div>;

  const vehicles = (vehiclesRaw ?? []) as VehicleRow[];

  return (
    <div className="page-shell w-full space-y-5 text-slate-200">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-blue-200 hover:text-blue-100">
          ← Zpět do adminu
        </Link>
        <h1 className="mt-3 text-3xl font-black text-white">Vozidla</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Správa pouze firemních aut. Soukromá auta se evidují u konkrétního zaměstnance v admin sekci Zaměstnanci.
        </p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-xl font-black text-white">Přidat firemní vozidlo</h2>
        <form action={createVehicleAction} className="space-y-4">
          <VehicleFields />
          <Button type="submit">Přidat firemní vozidlo</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id} className={["space-y-4", vehicle.aktivni ? "" : "opacity-60"].join(" ")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-black text-white">{vehicle.nazev}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {vehicle.spz || "Bez SPZ"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Firemní</Badge>
                <Badge variant={vehicle.aktivni ? "success" : "danger"}>
                  {vehicle.aktivni ? "Aktivní" : "Neaktivní"}
                </Badge>
              </div>
            </div>
            <form action={updateVehicleAction} className="space-y-4">
              <input type="hidden" name="id" value={vehicle.id} />
              <VehicleFields vehicle={vehicle} />
              <div className="flex flex-wrap gap-3">
                <Button type="submit">Uložit změny</Button>
                {vehicle.aktivni ? (
                  <button
                    formAction={deactivateVehicleAction}
                    className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white transition hover:bg-red-600"
                  >
                    Deaktivovat
                  </button>
                ) : null}
              </div>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
