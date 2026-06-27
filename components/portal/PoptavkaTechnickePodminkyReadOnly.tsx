import {
  TECHNICKE_REZIM_LABELS,
  TECHNIKA_SECTION_PHOTOS,
  VYJEZD_CENIK_LINES,
  technickeRezimFromRecord,
  formatTechnickePotvrzeni,
  formatTechnikVyjezdPreferovanyKontakt,
  formatTechnikVyjezdVypocetTyp,
} from "@/lib/client-portal/poptavka-technika-podminky";
import {
  TECHNIK_VYJEZD_KM_SAZBA_KC,
  TECHNIK_VYJEZD_MINIMUM_KC,
} from "@/lib/client-portal/technik-vyjezd-pricing";
import {
  SDILENA_PRIPOJKA_VAROVANI,
  formatElektroZdrojTyp,
  formatPripojkyCounts,
  formatStagePripojkaRezim,
  formatPrijezdAzKeStage,
  formatTriVolba,
  technikaFromRecord,
} from "@/lib/client-portal/poptavka-technika-form";
import { POPTAVKA_FOTKA_TYP_LABELS } from "@/lib/client-portal/poptavka-fotky-shared";
import type { PoptavkaFotkaWithUrl } from "@/lib/client-portal/poptavka-fotky-shared";
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
          <ReadOnlyField
            label="Typ zdroje elektřiny"
            value={formatElektroZdrojTyp(row.elektro_zdroj_typ)}
          />
          <ReadOnlyField label="Rozvaděče / elektro — popis" value={technika.rozvadece_poznamka} />
          <ReadOnlyField
            label="Hodnota hlavního chrániče větve"
            value={technika.hlavni_chranic_vetve}
          />
          <ReadOnlyField label="Přípojky v rozvaděči (5PIN)" value={formatPripojkyCounts(technika)} />
          <ReadOnlyField
            label="Přípojka pro stage techniku"
            value={formatStagePripojkaRezim(row.stage_pripojka_rezim)}
          />
          {row.stage_pripojka_rezim === "sdilena_s_dalsimi_odbery" ? (
            <div className="sm:col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-100">
              {SDILENA_PRIPOJKA_VAROVANI}
            </div>
          ) : null}
          <ReadOnlyField
            label="Vzdálenost od přípojky k síti / centrály"
            value={
              technika.elektro_vzdalenost_m ? `${technika.elektro_vzdalenost_m} m` : null
            }
          />
          <ReadOnlyField label="Příjezd — poznámka" value={technika.prijezd_poznamka} />
          <ReadOnlyField
            label="Příjezd až k místu stavby stage"
            value={formatPrijezdAzKeStage(technika, extra)}
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
        <div className="space-y-4">
          {row.technik_vyjezd_objednan_at ? (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50">
              <p className="font-semibold">Závazně objednaný výjezd technika</p>
              <p className="mt-1">
                Objednáno: {formatTechnickePotvrzeni(row.technik_vyjezd_objednan_at)}
              </p>
              <p className="mt-2 text-xs text-emerald-100/90">
                Poptávka byla odeslána ke zpracování — technické podmínky čekají na výjezd
                technika.
              </p>
            </div>
          ) : null}

          <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
            {VYJEZD_CENIK_LINES.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>Minimální cena výjezdu: {TECHNIK_VYJEZD_MINIMUM_KC.toLocaleString("cs-CZ")} Kč</li>
          </ul>

          {row.technik_vyjezd_vzdalenost_km != null ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200">
              <p>
                Orientační vzdálenost tam i zpět:{" "}
                <span className="font-semibold text-white">
                  {Number(row.technik_vyjezd_vzdalenost_km).toLocaleString("cs-CZ")} km
                </span>
              </p>
              {row.technik_vyjezd_doprava_kc != null ? (
                <p className="mt-1">
                  Orientační doprava ({TECHNIK_VYJEZD_KM_SAZBA_KC} Kč/km):{" "}
                  <span className="font-semibold text-white">
                    {Number(row.technik_vyjezd_doprava_kc).toLocaleString("cs-CZ")} Kč
                  </span>
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Typ výpočtu: {formatTechnikVyjezdVypocetTyp(row.technik_vyjezd_vypocet_typ)}
              </p>
            </div>
          ) : null}

          {row.technik_vyjezd_potvrzeni_fakturace_at ? (
            <p className="text-sm text-amber-100">
              Potvrzena fakturace výjezdu i při nerealizaci akce (
              {formatTechnickePotvrzeni(row.technik_vyjezd_potvrzeni_fakturace_at)})
            </p>
          ) : null}

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <ReadOnlyField label="Kontakt pro výjezd" value={row.technik_vyjezd_kontakt_jmeno} />
            <ReadOnlyField label="Telefon" value={row.technik_vyjezd_kontakt_telefon} />
            <ReadOnlyField label="E-mail" value={row.technik_vyjezd_kontakt_email} />
            <div>
              <dt className="text-slate-500">Preferovaný kontakt</dt>
              <dd className="text-slate-100">{formatTechnikVyjezdPreferovanyKontakt(row)}</dd>
            </div>
          </dl>

          <ReadOnlyField label="Poznámka k výjezdu" value={technika.dalsi_poznamky} />
        </div>
      ) : null}

      {fotky.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">Fotodokumentace sekcí</h3>
          {TECHNIKA_SECTION_PHOTOS.map((section) => {
            const sectionFotky = fotky.filter((fotka) => fotka.typ === section.typ);
            if (sectionFotky.length === 0) return null;
            return (
              <div key={section.key} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {section.label}
                </h4>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionFotky.map((fotka) => (
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
                      {fotka.original_filename ? (
                        <div className="truncate px-3 py-2 text-xs text-slate-400">
                          {fotka.original_filename}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500">K technickým sekcím nejsou připojené fotky.</p>
      )}
    </section>
  );
}
