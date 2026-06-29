"use client";

import type { ClientSetupPresetView } from "@/lib/client-portal/client-presets-shared";
import { SETUP_OBLAST_LABELS } from "@/lib/client-portal/labels";
import type { SetupOblast } from "@/lib/client-portal/types";

type Props = {
  presets: Array<ClientSetupPresetView & { used_on_this_place?: boolean }>;
  readOnly?: boolean;
  onApply: (preset: ClientSetupPresetView) => void;
};

export default function PoptavkaSavedSetupPresetsPanel({
  presets,
  readOnly = false,
  onApply,
}: Props) {
  if (presets.length === 0) return null;

  return (
    <section className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
      <div>
        <h3 className="text-sm font-semibold text-emerald-100">Moje uložené sestavy</h3>
        <p className="mt-1 text-xs text-slate-400">
          Presety vytvořené mimo poptávku — použijí se jen po kliknutí.
        </p>
      </div>

      <ul className="space-y-3">
        {presets.map((preset) => (
          <li
            key={preset.preset_id}
            className={[
              "rounded-xl border p-4",
              preset.used_on_this_place
                ? "border-amber-500/35 bg-amber-500/[0.06]"
                : "border-white/10 bg-white/[0.02]",
            ].join(" ")}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                {preset.used_on_this_place ? (
                  <span className="inline-flex rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-100">
                    Použito na tomto místě
                  </span>
                ) : null}
                <div className="font-semibold text-white">{preset.nazev}</div>
                {preset.popis ? (
                  <p className="text-sm text-slate-300">{preset.popis}</p>
                ) : null}
                {preset.summary_lines.length > 0 ? (
                  <ul className="space-y-1 text-sm text-slate-200">
                    {preset.summary_lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                {preset.setup_rows.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {preset.setup_rows.map((setup) => (
                      <span
                        key={setup.setup_id}
                        className="rounded-md border border-white/10 bg-slate-950 px-2 py-0.5 text-xs text-slate-300"
                      >
                        {setup.nazev} × {setup.mnozstvi} ·{" "}
                        {SETUP_OBLAST_LABELS[setup.oblast as SetupOblast]}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => onApply(preset)}
                  className="shrink-0 rounded-xl border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/30"
                >
                  Použít uloženou sestavu
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
