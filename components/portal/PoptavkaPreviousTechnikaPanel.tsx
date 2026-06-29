"use client";

import { SETUP_OBLAST_LABELS } from "@/lib/client-portal/labels";
import {
  PREVIOUS_TECHNIKA_DISCLAIMER,
  type ClientPortalPreviousTechnikaOption,
} from "@/lib/client-portal/client-previous-technika-shared";
import type { SetupOblast } from "@/lib/client-portal/types";

type Props = {
  title: string;
  options: Array<ClientPortalPreviousTechnikaOption & { used_on_this_place?: boolean }>;
  readOnly?: boolean;
  onApply: (option: ClientPortalPreviousTechnikaOption) => void;
  onSaveAsPreset?: (option: ClientPortalPreviousTechnikaOption) => void;
  savingPresetId?: string | null;
};

export default function PoptavkaPreviousTechnikaPanel({
  title,
  options,
  readOnly = false,
  onApply,
  onSaveAsPreset,
  savingPresetId = null,
}: Props) {
  if (options.length === 0) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">
          Zatím nemáte žádnou předchozí sestavu, kterou by bylo možné znovu použít.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
      <div>
        <h3 className="text-sm font-semibold text-blue-100">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{PREVIOUS_TECHNIKA_DISCLAIMER}</p>
      </div>

      <ul className="space-y-3">
        {options.map((option) => (
          <li
            key={option.option_id}
            className={[
              "rounded-xl border p-4",
              option.used_on_this_place
                ? "border-amber-500/35 bg-amber-500/[0.06]"
                : "border-white/10 bg-white/[0.02]",
            ].join(" ")}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {option.used_on_this_place ? (
                    <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-100">
                      Použito na tomto místě
                    </span>
                  ) : null}
                  <span
                    className={[
                      "rounded-md border px-2 py-0.5 text-xs font-semibold",
                      option.source_kind === "confirmed_order"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                        : "border-slate-600 bg-slate-900 text-slate-300",
                    ].join(" ")}
                  >
                    {option.source_label}
                  </span>
                  {option.oblast_badges.map((oblast: SetupOblast) => (
                    <span
                      key={oblast}
                      className="rounded-md border border-white/10 bg-slate-950 px-2 py-0.5 text-xs text-slate-300"
                    >
                      {SETUP_OBLAST_LABELS[oblast]}
                    </span>
                  ))}
                </div>

                <div>
                  <div className="font-semibold text-white">{option.akce_nazev}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {[option.datum_label, option.misto_label].filter(Boolean).join(" · ")}
                  </div>
                </div>

                {option.setupy.length > 0 ? (
                  <ul className="space-y-1 text-sm text-slate-200">
                    {option.setupy.map((setup) => (
                      <li key={setup.setup_id}>
                        {setup.nazev}{" "}
                        <span className="text-slate-400">× {setup.mnozstvi}</span>
                        {setup.poznamka_klienta ? (
                          <span className="text-slate-500"> — {setup.poznamka_klienta}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-300">Konfigurace sestavy bez samostatných setupů</p>
                )}

                {option.warnings.map((warning) => (
                  <p key={warning} className="text-xs text-amber-200/90">
                    {warning}
                  </p>
                ))}
              </div>

              {!readOnly ? (
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onApply(option)}
                    className="rounded-xl border border-blue-500/50 bg-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-50 hover:bg-blue-500/30"
                  >
                    Použít sestavu
                  </button>
                  {onSaveAsPreset ? (
                    <button
                      type="button"
                      disabled={savingPresetId === option.option_id}
                      onClick={() => onSaveAsPreset(option)}
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                    >
                      {savingPresetId === option.option_id
                        ? "Ukládám…"
                        : "Uložit jako moji sestavu"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
