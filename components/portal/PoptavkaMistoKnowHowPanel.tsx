"use client";

import type { ClientPortalMistoKnowHow } from "@/lib/client-portal/client-mista-shared";
import {
  formatMistoKnowHowDate,
  formatMistoTechnickaFotkaTyp,
  formatMistoTechnickaPoznamkaTyp,
} from "@/lib/client-portal/client-mista-shared";

type Props = {
  knowHow: ClientPortalMistoKnowHow | null;
};

export default function PoptavkaMistoKnowHowPanel({ knowHow }: Props) {
  if (!knowHow) {
    return null;
  }

  const { poznamky, fotky, loadError } = knowHow;
  const visibleFotky = fotky.filter((fotka) => fotka.signedUrl);

  return (
    <section className="space-y-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <div>
        <h3 className="text-sm font-semibold text-amber-100">Know-how z uloženého místa</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Údaje vycházejí z předchozích akcí na tomto místě. Zkontrolujte, že pro aktuální akci
          stále platí.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Know-how pro toto místo se nepodařilo načíst. Můžete pokračovat v poptávce ručně.
        </p>
      ) : null}

      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          Technické poznámky
        </h4>
        {poznamky.length === 0 ? (
          <p className="text-sm text-slate-500">
            K místu zatím nejsou uložené technické poznámky.
          </p>
        ) : (
          <ul className="space-y-2">
            {poznamky.map((poznamka) => (
              <li
                key={poznamka.id}
                className={[
                  "rounded-xl border px-3 py-3 text-sm",
                  poznamka.dulezite
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-white/10 bg-white/[0.02]",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-200">
                    {formatMistoTechnickaPoznamkaTyp(poznamka.typ)}
                  </span>
                  <span className="text-slate-500">{formatMistoKnowHowDate(poznamka.created_at)}</span>
                  {poznamka.dulezite ? (
                    <span className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-100">
                      Důležité
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-slate-200">{poznamka.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Fotky místa</h4>
        {fotky.length === 0 ? (
          <p className="text-sm text-slate-500">K místu zatím nejsou uložené fotky.</p>
        ) : visibleFotky.length === 0 ? (
          <p className="text-sm text-slate-500">
            K místu jsou uložené fotky, ale náhledy nejsou momentálně dostupné.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {visibleFotky.map((fotka) => (
              <li
                key={fotka.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
              >
                <img
                  src={fotka.signedUrl!}
                  alt={fotka.popis ?? formatMistoTechnickaFotkaTyp(fotka.typ)}
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="space-y-1 px-3 py-3 text-sm">
                  <div className="font-medium text-white">
                    {formatMistoTechnickaFotkaTyp(fotka.typ)}
                  </div>
                  {fotka.popis ? <div className="text-slate-400">{fotka.popis}</div> : null}
                  <div className="text-xs text-slate-500">
                    {formatMistoKnowHowDate(fotka.created_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
