import {
  TECHNICKE_REZIM_LABELS,
  VYJEZD_CENIK_LINES,
  technickeRezimFromRecord,
  formatTechnickePotvrzeni,
} from "@/lib/client-portal/poptavka-technika-podminky";
import {
  formatTriVolba,
  technikaFromRecord,
} from "@/lib/client-portal/poptavka-technika-form";
import { POPTAVKA_FOTKA_TYP_LABELS } from "@/lib/client-portal/poptavka-fotky-shared";
import type { PoptavkaFotkaWithUrl } from "@/lib/client-portal/poptavka-fotky-server";
import type { PoptavkaTechnickeUdaje } from "@/lib/client-portal/types";

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-100">{value}</dd>
    </div>
  );
}

export default function PoptavkaTechnickePodminkyReadOnly({
  row,
  fotky = [],
}: {
  row: PoptavkaTechnickeUdaje | null;
  fotky?: PoptavkaFotkaWithUrl[];
}) {
  if (!row) {
    return (
      <section className="mt-8 space-y-3 border-t border-white/10 pt-6">
        <h2 className="text-lg font-semibold text-white">Technické podmínky</h2>
        <p className="text-sm text-slate-500">Technické podmínky nebyly doplněny.</p>
      </section>
    );
  }

  const technika = technikaFromRecord(row);
  const rezim = technickeRezimFromRecord(row);
  const extra = row.odpovedi_extra ?? {};

  return (
    <section className="mt-8 space-y-4 border-t border-white/10 pt-6">
      <h2 className="text-lg font-semibold text-white">Technické podmínky</h2>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200">
        <div>
          <span className="text-slate-500">Režim: </span>
          {rezim ? TECHNICKE_REZIM_LABELS[rezim] : "Nezvoleno"}
        </div>
        {rezim === "klient_vyplni" && row.technicke_potvrzeni_odpovednosti_at ? (
          <div className="mt-2 text-emerald-200">
            Potvrzena odpovědnost za pravdivost informací (
            {formatTechnickePotvrzeni(row.technicke_potvrzeni_odpovednosti_at)})
          </div>
        ) : null}
        {rezim === "vyjezd_technika" && row.technicke_potvrzeni_vyjezd_ceny_at ? (
          <div className="mt-2 space-y-1 text-emerald-200">
            <div>
              Potvrzena cena výjezdu technika (
              {formatTechnickePotvrzeni(row.technicke_potvrzeni_vyjezd_ceny_at)})
            </div>
            <ul className="list-inside list-disc text-xs text-emerald-100/90">
              {VYJEZD_CENIK_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {rezim === "klient_vyplni" ? (
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <ReadOnlyField label="Rozvaděče / elektro" value={technika.rozvadece_poznamka} />
          <ReadOnlyField label="Přípojka / proud" value={technika.elektro_pripojka} />
          <ReadOnlyField label="Jištění" value={technika.elektro_jisteni} />
          <ReadOnlyField label="Typ zásuvky" value={technika.elektro_zasuvka} />
          <ReadOnlyField
            label="Vzdálenost elektřiny"
            value={
              technika.elektro_vzdalenost_m ? `${technika.elektro_vzdalenost_m} m` : null
            }
          />
          <ReadOnlyField label="Příjezd" value={technika.prijezd_poznamka} />
          <ReadOnlyField
            label="Lze zajet dodávkou"
            value={formatTriVolba(String(extra.lze_zajet_autem ?? ""))}
          />
          <ReadOnlyField
            label="Vzdálenost od vykládky"
            value={technika.vzdalenost_vykladka_stage}
          />
          <ReadOnlyField
            label="Povrch zpevněný"
            value={formatTriVolba(String(extra.misto_zpevnene ?? ""))}
          />
          <ReadOnlyField label="Přístup pro techniku" value={technika.pristup_pro_techniku} />
          <ReadOnlyField label="Místo pro stage" value={technika.misto_stage} />
          <ReadOnlyField label="Omezení průjezdu" value={technika.omezeni_prujezdu} />
          <ReadOnlyField
            label="Kabel přes silnici"
            value={formatTriVolba(String(extra.kabel_pres_silnici ?? ""))}
          />
          <ReadOnlyField label="Kabelové trasy" value={technika.kabelove_trasy} />
          <ReadOnlyField label="Parkování" value={technika.parkovani_poznamka} />
          <ReadOnlyField label="Poznámka" value={technika.dalsi_poznamky} />
        </dl>
      ) : null}

      {rezim === "vyjezd_technika" ? (
        <ReadOnlyField label="Poznámka k výjezdu" value={technika.dalsi_poznamky} />
      ) : null}

      {fotky.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Fotodokumentace sekcí</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {fotky.map((fotka) => (
              <li
                key={fotka.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
              >
                {fotka.signedUrl ? (
                  <img
                    src={fotka.signedUrl}
                    alt={fotka.original_filename ?? POPTAVKA_FOTKA_TYP_LABELS[fotka.typ]}
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-sm text-slate-500">
                    Náhled nedostupný
                  </div>
                )}
                <div className="px-3 py-2 text-xs text-slate-400">
                  {POPTAVKA_FOTKA_TYP_LABELS[fotka.typ]}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-slate-500">K technickým sekcím nejsou připojené fotky.</p>
      )}
    </section>
  );
}
