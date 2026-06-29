"use client";

import {
  PREVIOUS_TECHNIKA_PROFILE_WARNING,
  type ClientPortalPreviousTechnikaProfileOption,
} from "@/lib/client-portal/client-previous-technika-profiles-shared";
import type { ClientTechnicalPreset } from "@/lib/client-portal/client-presets-shared";
import { buildTechnikaSummaryBrief } from "@/lib/client-portal/poptavka-technika-form";

type HistoryOption = ClientPortalPreviousTechnikaProfileOption & {
  used_on_this_place?: boolean;
};

type SavedPresetOption = ClientTechnicalPreset & {
  used_on_this_place?: boolean;
};

type Props = {
  historyOptions: HistoryOption[];
  savedPresets: SavedPresetOption[];
  readOnly?: boolean;
  applyingId?: string | null;
  savingPresetId?: string | null;
  onApplyHistory: (option: ClientPortalPreviousTechnikaProfileOption) => void;
  onApplySavedPreset: (preset: ClientTechnicalPreset) => void;
  onSaveHistoryAsPreset?: (option: ClientPortalPreviousTechnikaProfileOption) => void;
};

export default function PoptavkaPreviousTechnikaProfilesPanel({
  historyOptions,
  savedPresets,
  readOnly = false,
  applyingId = null,
  savingPresetId = null,
  onApplyHistory,
  onApplySavedPreset,
  onSaveHistoryAsPreset,
}: Props) {
  if (historyOptions.length === 0 && savedPresets.length === 0) {
    return (
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white">Moje předchozí technické varianty</h3>
        <p className="mt-2 text-sm text-slate-500">
          Zatím nemáte uložené technické profily ani historii z předchozích akcí.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <div>
        <h3 className="text-sm font-semibold text-amber-100">
          Použít technické údaje z předchozí akce
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {PREVIOUS_TECHNIKA_PROFILE_WARNING}
        </p>
      </div>

      {savedPresets.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Moje technické profily
          </h4>
          <ul className="space-y-3">
            {savedPresets.map((preset) => (
              <PresetRow
                key={preset.preset_id}
                title={preset.nazev}
                summary={buildTechnikaSummaryBrief(preset.technicke_data)}
                usedOnThisPlace={preset.used_on_this_place}
                readOnly={readOnly}
                busy={applyingId === `preset:${preset.preset_id}`}
                applyLabel="Použít technický profil"
                onApply={() => onApplySavedPreset(preset)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {historyOptions.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Z předchozích akcí
          </h4>
          <ul className="space-y-3">
            {historyOptions.map((option) => (
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
                      {option.has_photos ? (
                        <span className="rounded-md border border-white/10 bg-slate-950 px-2 py-0.5 text-xs text-slate-300">
                          {option.photo_count} fotek
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{option.akce_nazev}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {[option.datum_label, option.misto_label].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <p className="text-sm text-slate-200">{option.technika_summary}</p>
                  </div>

                  {!readOnly ? (
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        disabled={applyingId === option.option_id}
                        onClick={() => onApplyHistory(option)}
                        className="rounded-xl border border-amber-500/50 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500/30 disabled:opacity-60"
                      >
                        {applyingId === option.option_id
                          ? "Načítám…"
                          : "Použít tyto technické údaje"}
                      </button>
                      {onSaveHistoryAsPreset ? (
                        <button
                          type="button"
                          disabled={savingPresetId === option.option_id}
                          onClick={() => onSaveHistoryAsPreset(option)}
                          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                        >
                          {savingPresetId === option.option_id
                            ? "Ukládám…"
                            : "Uložit jako technický profil"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function PresetRow({
  title,
  summary,
  usedOnThisPlace,
  readOnly,
  busy,
  applyLabel,
  onApply,
}: {
  title: string;
  summary: string;
  usedOnThisPlace?: boolean;
  readOnly: boolean;
  busy: boolean;
  applyLabel: string;
  onApply: () => void;
}) {
  return (
    <li
      className={[
        "rounded-xl border p-4",
        usedOnThisPlace
          ? "border-amber-500/35 bg-amber-500/[0.06]"
          : "border-white/10 bg-white/[0.02]",
      ].join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          {usedOnThisPlace ? (
            <span className="inline-flex rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-100">
              Použito na tomto místě
            </span>
          ) : null}
          <div className="font-semibold text-white">{title}</div>
          <p className="text-sm text-slate-200">{summary}</p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            disabled={busy}
            onClick={onApply}
            className="shrink-0 rounded-xl border border-amber-500/50 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500/30 disabled:opacity-60"
          >
            {busy ? "Načítám…" : applyLabel}
          </button>
        ) : null}
      </div>
    </li>
  );
}
