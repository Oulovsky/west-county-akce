import { WEST_COUNTY_HQ } from "@/lib/locations/west-county-hq";

type Props = {
  mistoAdresa?: string | null;
  presnyPopisMista?: string | null;
  mistoLat?: number | null;
  mistoLng?: number | null;
  variant?: "portal" | "internal";
};

export default function PoptavkaMistoReadOnly({
  mistoAdresa,
  presnyPopisMista,
  mistoLat,
  mistoLng,
  variant = "portal",
}: Props) {
  const hasGps =
    mistoLat != null &&
    mistoLng != null &&
    Number.isFinite(Number(mistoLat)) &&
    Number.isFinite(Number(mistoLng));

  const borderClass =
    variant === "internal"
      ? "border-amber-500/40 bg-amber-500/10"
      : "border-white/10 bg-white/[0.02]";

  return (
    <section className={`mt-6 space-y-3 rounded-xl border ${borderClass} p-4`}>
      <h3 className="text-sm font-semibold text-white">Přesné místo akce</h3>
      {mistoAdresa ? (
        <div className="text-sm text-slate-300">
          <span className="text-slate-500">Adresa / obec: </span>
          {mistoAdresa}
        </div>
      ) : null}
      {presnyPopisMista?.trim() ? (
        <div className="text-sm text-slate-200">
          <span className="text-slate-500">Přesný popis místa: </span>
          <span className="whitespace-pre-wrap">{presnyPopisMista}</span>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Přesný popis místa nebyl vyplněn.</p>
      )}
      {hasGps ? (
        <div className="text-sm text-slate-200">
          <span className="text-slate-500">GPS bod: </span>
          {Number(mistoLat).toFixed(6)}, {Number(mistoLng).toFixed(6)}
          <span className="mt-1 block text-xs text-slate-500">
            Vzdálenosti se počítají z {WEST_COUNTY_HQ.name}.
          </span>
        </div>
      ) : (
        <p className="text-sm text-amber-200/90">GPS bod nebyl zadán.</p>
      )}
    </section>
  );
}
