import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import { getApprovalStatusLabel, normalizeApprovalStatus } from "@/lib/approval";
import {
  DEFAULT_KM_RATE,
  formatDateTime,
  formatKm,
  getTransportTypeLabel,
  getTravelClaimedAmount,
  getVehicleTypeLabel,
} from "@/lib/transport";
import { formatMoneyCzk } from "@/lib/payments";
import { addTransportAction, deleteTransportAction, updateTransportAction } from "../doprava-actions";

type VehicleRow = {
  id: string;
  nazev: string;
  spz: string | null;
  typ: string | null;
  vlastnik_user_id: string | null;
  aktivni: boolean | null;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  jmeno: string | null;
  prijmeni: string | null;
};

type TransportRow = {
  id: string;
  zakazka_id: string;
  vozidlo_id: string | null;
  typ_dopravy: string;
  user_id: string | null;
  odjezd_at: string | null;
  prijezd_at: string | null;
  odkud: string | null;
  kam: string | null;
  poznamka: string | null;
  override_reason: string | null;
};

type TravelRow = {
  id: string;
  zakazka_doprava_id: string | null;
  user_id: string;
  km: number | string;
  sazba_za_km: number | string;
  claimed_amount_czk?: number | string | null;
  approval_status?: string | null;
  status?: string | null;
};

function profileLabel(profile?: ProfileRow | null) {
  const name = [profile?.jmeno, profile?.prijmeni].filter(Boolean).join(" ").trim();
  return name || profile?.email || "Člověk";
}

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function TransportFields({
  zakazkaId,
  row,
  companyVehicles,
  privateVehicles,
  profiles,
  includeTravelFields = false,
}: {
  zakazkaId: string;
  row?: Partial<TransportRow>;
  companyVehicles: VehicleRow[];
  privateVehicles: VehicleRow[];
  profiles: ProfileRow[];
  includeTravelFields?: boolean;
}) {
  const profilesById = new Map(profiles.map((profile) => [profile.user_id, profile]));

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="zakazka_id" value={zakazkaId} />
      {row?.id ? <input type="hidden" name="id" value={row.id} /> : null}
      <Field label="Typ dopravy">
        <select
          name="typ_dopravy"
          defaultValue={row?.typ_dopravy ?? "firemni_auto"}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="firemni_auto">Firemní auto</option>
          <option value="soukrome_auto">Soukromé auto</option>
          <option value="pouze_presun_cloveka">Pouze přesun člověka</option>
        </select>
      </Field>
      <Field label="Vozidlo">
        <select
          name="vozidlo_id"
          defaultValue={row?.vozidlo_id ?? ""}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">Bez vozidla</option>
          <optgroup label="Firemní auta">
            {companyVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.nazev} {vehicle.spz ? `· ${vehicle.spz}` : ""}
              </option>
            ))}
          </optgroup>
          <optgroup label="Soukromá auta podle vlastníka">
            {privateVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {profileLabel(profilesById.get(vehicle.vlastnik_user_id ?? ""))}: {vehicle.nazev}
                {vehicle.spz ? ` · ${vehicle.spz}` : ""}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="mt-1 text-xs text-slate-500">
          Soukromé auto může zůstat bez pevného vozidla, pokud ho zaměstnanec nemá v profilu.
        </div>
      </Field>
      <Field label="Člověk">
        <select
          name="user_id"
          defaultValue={row?.user_id ?? ""}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">Bez člověka</option>
          {profiles.map((profile) => (
            <option key={profile.user_id} value={profile.user_id}>
              {profileLabel(profile)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Odjezd">
        <Input name="odjezd_at" type="datetime-local" defaultValue={toLocalDateTime(row?.odjezd_at)} />
      </Field>
      <Field label="Příjezd">
        <Input name="prijezd_at" type="datetime-local" defaultValue={toLocalDateTime(row?.prijezd_at)} />
      </Field>
      <Field label="Odkud">
        <Input name="odkud" defaultValue={row?.odkud ?? ""} />
      </Field>
      <Field label="Kam">
        <Input name="kam" defaultValue={row?.kam ?? ""} />
      </Field>
      <Field label="Důvod override kolize">
        <Input name="override_reason" defaultValue={row?.override_reason ?? ""} placeholder="Povinné jen při kolizi" />
      </Field>
      {includeTravelFields ? (
        <>
          <Field label="Km pro cestovní náhradu">
            <Input name="km" type="number" min="0" step="0.1" />
          </Field>
          <Field label="Sazba za km">
            <Input name="sazba_za_km" type="number" min="0" step="0.1" defaultValue={DEFAULT_KM_RATE} />
          </Field>
        </>
      ) : null}
      <div className="md:col-span-2">
        <Field label="Poznámka">
          <Textarea name="poznamka" rows={2} defaultValue={row?.poznamka ?? ""} />
        </Field>
      </div>
    </div>
  );
}

export async function ZakazkaDopravaCard({ zakazkaId }: { zakazkaId: string }) {
  const supabase = await createClient();
  const [{ data: vehiclesRaw }, { data: profilesRaw }, { data: transportsRaw }, { data: travelRaw }] =
    await Promise.all([
      supabase.from("vozidla").select("id, nazev, spz, typ, vlastnik_user_id, aktivni").eq("aktivni", true).order("nazev"),
      supabase.from("profiles").select("user_id, email, jmeno, prijmeni").order("prijmeni"),
      supabase.from("zakazka_doprava").select("*").eq("zakazka_id", zakazkaId).order("odjezd_at"),
      supabase
        .from("cestovni_nahrady")
        .select("id, zakazka_doprava_id, user_id, km, sazba_za_km, claimed_amount_czk, approval_status, status")
        .eq("zakazka_id", zakazkaId),
    ]);

  const vehicles = (vehiclesRaw ?? []) as VehicleRow[];
  const companyVehicles = vehicles.filter((vehicle) => vehicle.typ === "firemni");
  const privateVehicles = vehicles.filter((vehicle) => vehicle.typ === "soukrome");
  const profiles = (profilesRaw ?? []) as ProfileRow[];
  const transports = (transportsRaw ?? []) as TransportRow[];
  const travelRows = (travelRaw ?? []) as TravelRow[];
  const profilesById = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const travelByTransport = new Map<string, TravelRow[]>();
  for (const row of travelRows) {
    if (!row.zakazka_doprava_id) continue;
    travelByTransport.set(row.zakazka_doprava_id, [...(travelByTransport.get(row.zakazka_doprava_id) ?? []), row]);
  }

  return (
    <Card className="mt-6 space-y-5 border-slate-700 bg-[#0b1324]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">Doprava</h2>
          <p className="mt-1 text-sm text-slate-400">
            Plán aut, přesunů lidí a soukromých cest. Kolize zatím jen varují a vyžadují override důvod.
          </p>
        </div>
        <Badge variant="default">{transports.length} záznamů</Badge>
      </div>

      <details className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <summary className="cursor-pointer text-sm font-black text-blue-100">Přidat dopravu</summary>
        <form action={addTransportAction} className="mt-4 space-y-4">
          <TransportFields
            zakazkaId={zakazkaId}
            companyVehicles={companyVehicles}
            privateVehicles={privateVehicles}
            profiles={profiles}
            includeTravelFields
          />
          <Button type="submit">Přidat dopravu</Button>
        </form>
      </details>

      {transports.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
          Doprava zatím není naplánovaná.
        </div>
      ) : (
        <div className="space-y-3">
          {transports.map((row) => {
            const vehicle = vehiclesById.get(row.vozidlo_id ?? "");
            const travel = travelByTransport.get(row.id) ?? [];
            return (
              <details key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4" open={false}>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">{getTransportTypeLabel(row.typ_dopravy)}</div>
                      <div className="mt-1 text-sm text-slate-300">
                        {row.odkud || "Odkud ?"} → {row.kam || "Kam ?"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDateTime(row.odjezd_at)} - {formatDateTime(row.prijezd_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {vehicle ? <Badge variant="success">{vehicle.nazev}</Badge> : null}
                      {row.user_id ? <Badge variant="default">{profileLabel(profilesById.get(row.user_id))}</Badge> : null}
                      {row.override_reason ? <Badge variant="warning">Override</Badge> : null}
                    </div>
                  </div>
                </summary>

                {travel.length > 0 ? (
                  <div className="mt-4 grid gap-2">
                    {travel.map((item) => (
                      <div key={item.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
                        Cestovní náhrada: {formatKm(item.km)} · nárok{" "}
                        {formatMoneyCzk(getTravelClaimedAmount(item))} ·{" "}
                        {getApprovalStatusLabel(normalizeApprovalStatus(item.approval_status ?? item.status))}
                      </div>
                    ))}
                  </div>
                ) : null}

                <form action={updateTransportAction} className="mt-4 space-y-4">
                  <TransportFields
                    zakazkaId={zakazkaId}
                    row={row}
                    companyVehicles={companyVehicles}
                    privateVehicles={privateVehicles}
                    profiles={profiles}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit">Uložit dopravu</Button>
                    <button
                      formAction={deleteTransportAction}
                      className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white transition hover:bg-red-600"
                    >
                      Smazat dopravu
                    </button>
                  </div>
                </form>
              </details>
            );
          })}
        </div>
      )}
    </Card>
  );
}
