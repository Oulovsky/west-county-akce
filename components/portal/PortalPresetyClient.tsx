"use client";

import { useMemo, useState } from "react";
import {
  deletePlacePresetAction,
  deleteSetupPresetAction,
  deleteTechnicalPresetAction,
  savePlacePresetAction,
  saveTechnicalPresetAction,
} from "@/app/portal/presety/actions";
import type {
  ClientPlacePreset,
  ClientSetupPresetView,
  ClientTechnicalPreset,
} from "@/lib/client-portal/client-presets-shared";
import {
  EMPTY_POPTAVKA_TECHNIKA,
  buildTechnikaSummaryBrief,
} from "@/lib/client-portal/poptavka-technika-form";

type Tab = "mista" | "technika" | "sestavy";

type Props = {
  placePresets: ClientPlacePreset[];
  technicalPresets: ClientTechnicalPreset[];
  setupPresets: ClientSetupPresetView[];
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2";
const labelClass = "text-sm font-medium text-slate-300";

export default function PortalPresetyClient({
  placePresets,
  technicalPresets,
  setupPresets,
}: Props) {
  const [tab, setTab] = useState<Tab>("mista");

  const tabs = useMemo(
    () =>
      [
        { id: "mista" as const, label: "Místa", count: placePresets.length },
        { id: "technika" as const, label: "Technické profily", count: technicalPresets.length },
        { id: "sestavy" as const, label: "Sestavy", count: setupPresets.length },
      ] as const,
    [placePresets.length, technicalPresets.length, setupPresets.length]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              "rounded-xl border px-4 py-2 text-sm font-semibold transition",
              tab === item.id
                ? "border-amber-500/50 bg-amber-500/20 text-amber-50"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20",
            ].join(" ")}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      {tab === "mista" ? (
        <div className="space-y-6">
          <form action={savePlacePresetAction} className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-base font-semibold text-white">Nové uložené místo</h2>
            <PresetField label="Název místa *" name="nazev" required />
            <PresetField label="Adresa" name="adresa_text" />
            <div className="grid gap-4 sm:grid-cols-2">
              <PresetField label="GPS šířka" name="lat" />
              <PresetField label="GPS délka" name="lng" />
            </div>
            <PresetTextarea label="Přesný popis místa" name="presny_popis_mista" />
            <PresetTextarea label="Poznámka k příjezdu" name="poznamka_prijezd" />
            <PresetTextarea label="Omezení vjezdu" name="omezeni_vjezdu" />
            <PresetTextarea label="Poznámky k manipulaci / stavbě" name="poznamka_manipulace" />
            <PresetTextarea label="Interní klientská poznámka" name="interni_poznamka_klienta" />
            <button
              type="submit"
              className="rounded-xl border border-amber-500/50 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-50"
            >
              Uložit místo
            </button>
          </form>

          <PresetList
            empty="Zatím nemáte uložená místa."
            items={placePresets.map((preset) => ({
              id: preset.preset_id,
              title: preset.nazev,
              subtitle: preset.adresa_text ?? "Bez adresy",
              onDelete: () => deletePlacePresetAction(preset.preset_id),
            }))}
          />
        </div>
      ) : null}

      {tab === "technika" ? (
        <div className="space-y-6">
          <form action={saveTechnicalPresetAction} className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-base font-semibold text-white">Nový technický profil</h2>
            <p className="text-sm text-slate-400">
              Základní profil lze vytvořit zde; detailní úpravu provedete při použití v poptávce
              nebo uložením z historie akce.
            </p>
            <PresetField label="Název profilu *" name="nazev" required />
            <input
              type="hidden"
              name="technicke_data_json"
              value={JSON.stringify({
                ...EMPTY_POPTAVKA_TECHNIKA,
                technicke_rezim: "klient_vyplni",
              })}
            />
            <button
              type="submit"
              className="rounded-xl border border-amber-500/50 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-50"
            >
              Vytvořit technický profil
            </button>
          </form>

          <PresetList
            empty="Zatím nemáte technické profily."
            items={technicalPresets.map((preset) => ({
              id: preset.preset_id,
              title: preset.nazev,
              subtitle: buildTechnikaSummaryBrief(preset.technicke_data),
              onDelete: () => deleteTechnicalPresetAction(preset.preset_id),
            }))}
          />
        </div>
      ) : null}

      {tab === "sestavy" ? (
        <div className="space-y-6">
          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-slate-400">
            Novou sestavu s konfigurací uložíte ve formuláři poptávky tlačítkem „Uložit jako moji
            sestavu“ u historické akce na kroku 3.
          </p>

          <PresetList
            empty="Zatím nemáte uložené sestavy."
            items={setupPresets.map((preset) => ({
              id: preset.preset_id,
              title: preset.nazev,
              subtitle:
                preset.summary_lines.join(" · ") ||
                preset.setup_rows.map((row) => `${row.nazev} × ${row.mnozstvi}`).join(", ") ||
                "Sestava",
              onDelete: () => deleteSetupPresetAction(preset.preset_id),
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}

function PresetField({
  label,
  name,
  required = false,
}: {
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className={labelClass}>{label}</span>
      <input name={name} required={required} className={inputClass} />
    </label>
  );
}

function PresetTextarea({ label, name }: { label: string; name: string }) {
  return (
    <label className="block space-y-2">
      <span className={labelClass}>{label}</span>
      <textarea name={name} rows={3} className={inputClass} />
    </label>
  );
}

function PresetList({
  empty,
  items,
}: {
  empty: string;
  items: Array<{ id: string; title: string; subtitle: string; onDelete: () => void }>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div>
            <div className="font-semibold text-white">{item.title}</div>
            <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Opravdu smazat tento preset?")) {
                item.onDelete();
              }
            }}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100"
          >
            Smazat
          </button>
        </li>
      ))}
    </ul>
  );
}
