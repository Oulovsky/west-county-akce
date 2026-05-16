import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

type ZakazkaHeaderCardProps = {
  zakazkaId: string;
  data: {
    cislo_zakazky?: string | null;
    nazev?: string | null;
    misto?: string | null;
    misto_lat?: number | string | null;
    misto_lng?: number | string | null;
    misto_gps_radius_m?: number | string | null;
    typ_obsluhy?: string | null;
    poznamka?: string | null;
  };
  cancelAction: () => Promise<void>;
};

export function ZakazkaHeaderCard({
  zakazkaId,
  data,
  cancelAction,
}: ZakazkaHeaderCardProps) {
  const lat = String(data.misto_lat ?? "").trim();
  const lng = String(data.misto_lng ?? "").trim();
  const hasGps = Boolean(lat && lng);
  const navigationQuery = hasGps ? `${lat},${lng}` : (data.misto ?? "").trim();
  const navigationHref = navigationQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navigationQuery)}`
    : null;

  return (
    <Card className="mt-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-4xl font-bold text-white">
              {data.cislo_zakazky} – {data.nazev}
            </div>
            <div className="text-lg text-slate-400">{data.misto || "—"}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={hasGps ? "success" : "warning"}>
                {hasGps ? "GPS zadána" : "GPS chybí"}
              </Badge>
              <Badge variant="default">
                Radius: {data.misto_gps_radius_m ?? 300} m
              </Badge>
              {navigationHref ? (
                <a
                  href={navigationHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-blue-500/40 px-3 py-1.5 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/10"
                >
                  Navigovat
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Typ obsluhy">
              <div className="mt-2">
                <Badge variant="default">
                  {data.typ_obsluhy === "bez_obsluhy" ? "Bez obsluhy" : "S obsluhou"}
                </Badge>
              </div>
            </Field>

            <Field label="Poznámka">
              <div className="mt-2 text-slate-400">{data.poznamka || "—"}</div>
            </Field>
          </div>
        </div>

        <Card className="border-red-500/20 bg-red-950/10">
          <div className="space-y-4">
            <div className="text-base font-semibold text-white">Správa zakázky</div>

            <Link
              href={`/zakazky/${zakazkaId}/poskozeni`}
              className="block w-full rounded-xl border border-amber-500/40 px-4 py-3 text-center font-semibold text-amber-300 transition hover:bg-amber-500/10 hover:text-amber-200"
            >
              Poškození na zakázce
            </Link>

            <form action={cancelAction}>
              <button
                type="submit"
                className="w-full rounded-xl border border-red-500/40 px-4 py-3 font-semibold text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
              >
                Zrušit zakázku
              </button>
            </form>

            <div className="text-sm text-slate-400">
              Zakázka se přesune mimo běžný seznam a odpojí se od techniky, lidí a nakládky.
            </div>
          </div>
        </Card>
      </div>
    </Card>
  );
}