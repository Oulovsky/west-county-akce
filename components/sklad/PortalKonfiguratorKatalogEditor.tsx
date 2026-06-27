"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import {
  resetPortalKonfiguratorKatalogAction,
  savePortalKonfiguratorKatalogAction,
} from "@/app/sklad/konfigurace/portal-konfigurator/actions";
import type {
  PortalKonfiguratorKatalogRow,
  PortalSestavaKatalog,
} from "@/lib/client-portal/sestava-konfigurator-types";
import type { PortalKonfiguratorAdminOptions } from "@/lib/sklad/portal-konfigurator-admin-server";

type Props = {
  initialRow: PortalKonfiguratorKatalogRow;
  options: PortalKonfiguratorAdminOptions;
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white";
const labelClass = "text-xs font-medium text-slate-400";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-slate-700 bg-slate-950/50 p-4">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      {children}
    </Card>
  );
}

export default function PortalKonfiguratorKatalogEditor({ initialRow, options }: Props) {
  const [obsah, setObsah] = useState<PortalSestavaKatalog>(initialRow.obsah);
  const [aktivni, setAktivni] = useState(initialRow.aktivni);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const metaLabel = initialRow.from_db
    ? `Načteno z DB · verze ${initialRow.verze}${
        initialRow.updated_at
          ? ` · ${new Date(initialRow.updated_at).toLocaleString("cs-CZ")}`
          : ""
      }`
    : "Zobrazen výchozí katalog z kódu — v DB zatím není uložen";

  const obsahJson = useMemo(() => JSON.stringify(obsah), [obsah]);

  function save() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("obsah_json", obsahJson);
      formData.set("aktivni", aktivni ? "true" : "false");
      const result = await savePortalKonfiguratorKatalogAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Katalog byl uložen.");
    });
  }

  function resetDefault() {
    if (!confirm("Obnovit výchozí katalog z kódu? Aktuální úpravy v DB budou přepsány.")) {
      return;
    }
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await resetPortalKonfiguratorKatalogAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-slate-400">{metaLabel}</p>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={aktivni}
              onChange={(e) => setAktivni(e.target.checked)}
            />
            Katalog aktivní pro klientský portál
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetDefault}
            disabled={pending}
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Obnovit výchozí katalog
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Ukládám…" : "Uložit katalog"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <Section title="Mobilní stage">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className={labelClass}>Název</span>
            <input
              className={inputClass}
              value={obsah.mobilni_stage.nazev}
              onChange={(e) =>
                setObsah({
                  ...obsah,
                  mobilni_stage: { ...obsah.mobilni_stage, nazev: e.target.value },
                })
              }
            />
          </label>
          <NumberInput
            label="Default šířka (m)"
            value={obsah.mobilni_stage.default_sirka_m}
            onChange={(v) =>
              setObsah({
                ...obsah,
                mobilni_stage: { ...obsah.mobilni_stage, default_sirka_m: v },
              })
            }
          />
          <NumberInput
            label="Default hloubka (m)"
            value={obsah.mobilni_stage.default_hloubka_m}
            onChange={(v) =>
              setObsah({
                ...obsah,
                mobilni_stage: { ...obsah.mobilni_stage, default_hloubka_m: v },
              })
            }
          />
          <NumberInput
            label="Max čistá výška (m)"
            value={obsah.mobilni_stage.max_cista_vyska_m}
            onChange={(v) =>
              setObsah({
                ...obsah,
                mobilni_stage: { ...obsah.mobilni_stage, max_cista_vyska_m: v },
              })
            }
          />
        </div>
      </Section>

      <VariantTable
        title="Zastřešení — varianty"
        rows={obsah.zastreseni_varianty}
        onChange={(rows) => setObsah({ ...obsah, zastreseni_varianty: rows })}
        columns={[
          { key: "id", label: "ID", type: "text" },
          { key: "nazev", label: "Název", type: "text" },
          { key: "min_sirka_m", label: "Min šířka", type: "number" },
          { key: "max_sirka_m", label: "Max šířka", type: "number" },
          { key: "min_hloubka_m", label: "Min hloubka", type: "number" },
          { key: "max_hloubka_m", label: "Max hloubka", type: "number" },
          { key: "max_cista_vyska_m", label: "Max čistá výška", type: "number" },
        ]}
        newRow={() => ({
          id: `nova_${Date.now()}`,
          nazev: "Nová varianta",
          sirka_m: 8,
          hloubka_m: 6,
          min_sirka_m: 8,
          max_sirka_m: 8,
          min_hloubka_m: 6,
          max_hloubka_m: 6,
          max_cista_vyska_m: 5,
          doporucena_sirky_m: [8],
          doporucene_hloubky_m: [6],
          povolene_podium_ids: [],
          aktivni: true,
          poradi: obsah.zastreseni_varianty.length + 1,
        })}
      />

      <Section title="Pódium — moduly a výšky">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberInput
            label="Šířka modulu (m)"
            value={obsah.podium_modul_sirka_m}
            onChange={(v) => setObsah({ ...obsah, podium_modul_sirka_m: v })}
          />
          <NumberInput
            label="Hloubka modulu (m)"
            value={obsah.podium_modul_hloubka_m}
            onChange={(v) => setObsah({ ...obsah, podium_modul_hloubka_m: v })}
          />
          <label className="space-y-1">
            <span className={labelClass}>Dostupné výšky pódia (m, čárkou)</span>
            <input
              className={inputClass}
              value={obsah.podium_vysky_m.join(", ")}
              onChange={(e) =>
                setObsah({
                  ...obsah,
                  podium_vysky_m: e.target.value
                    .split(",")
                    .map((part) => Number(part.trim().replace(",", ".")))
                    .filter((n) => Number.isFinite(n)),
                })
              }
            />
          </label>
        </div>
      </Section>

      <VariantTable
        title="Pódium — katalogové varianty"
        rows={obsah.podium_varianty ?? []}
        onChange={(rows) => setObsah({ ...obsah, podium_varianty: rows })}
        columns={[
          { key: "id", label: "ID", type: "text" },
          { key: "nazev", label: "Název", type: "text" },
          { key: "sirka_m", label: "Šířka (m)", type: "number" },
          { key: "hloubka_m", label: "Hloubka (m)", type: "number" },
        ]}
        newRow={() => ({
          id: `podium_${Date.now()}`,
          nazev: "Pódium",
          sirka_m: 6,
          hloubka_m: 4,
          aktivni: true,
          poradi: (obsah.podium_varianty ?? []).length + 1,
        })}
      />

      <VariantTable
        title="Praktikábl / drum riser"
        rows={obsah.praktikabl_varianty}
        onChange={(rows) => setObsah({ ...obsah, praktikabl_varianty: rows })}
        columns={[
          { key: "id", label: "ID", type: "text" },
          { key: "nazev", label: "Název", type: "text" },
          { key: "sirka_m", label: "Šířka", type: "number" },
          { key: "hloubka_m", label: "Hloubka", type: "number" },
          { key: "vyska_m", label: "Výška", type: "number" },
        ]}
        newRow={() => ({
          id: `praktikabl_${Date.now()}`,
          nazev: "Nový praktikábl",
          sirka_m: 2,
          hloubka_m: 2,
          vyska_m: 0.4,
          aktivni: true,
          poradi: obsah.praktikabl_varianty.length + 1,
        })}
      />

      <LedTable
        rows={obsah.led_typy}
        skladPolozky={options.skladPolozky}
        onChange={(rows) => setObsah({ ...obsah, led_typy: rows })}
      />

      <PresetTable
        title="Zvukové presety"
        rows={obsah.zvuk_presety}
        oblast="sound"
        setupy={options.setupy.filter((row) => row.oblast === "sound")}
        onChange={(rows) => setObsah({ ...obsah, zvuk_presety: rows })}
      />

      <PresetTable
        title="Světelné presety"
        rows={obsah.svetla_presety}
        oblast="lights"
        setupy={options.setupy.filter((row) => row.oblast === "lights")}
        onChange={(rows) => setObsah({ ...obsah, svetla_presety: rows })}
      />

      <Section title="Kamery / dron">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberInput
            label="Max počet kamer"
            value={obsah.kamery_dron.max_pocet_kamer}
            onChange={(v) =>
              setObsah({
                ...obsah,
                kamery_dron: { ...obsah.kamery_dron, max_pocet_kamer: Math.max(0, Math.floor(v)) },
              })
            }
          />
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={obsah.kamery_dron.dron_povolen}
              onChange={(e) =>
                setObsah({
                  ...obsah,
                  kamery_dron: { ...obsah.kamery_dron, dron_povolen: e.target.checked },
                })
              }
            />
            Dron povolen v portálu
          </label>
        </div>
        <label className="mt-3 block space-y-1">
          <span className={labelClass}>Poznámka pro klienta</span>
          <textarea
            className={inputClass}
            rows={2}
            value={obsah.kamery_dron.poznamka}
            onChange={(e) =>
              setObsah({
                ...obsah,
                kamery_dron: { ...obsah.kamery_dron, poznamka: e.target.value },
              })
            }
          />
        </label>
      </Section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/sklad/konfigurace"
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300"
        >
          ← Zpět na konfiguraci skladu
        </Link>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        step="0.1"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

type ColumnDef = { key: string; label: string; type: "text" | "number" };

function VariantTable<T extends Record<string, unknown>>({
  title,
  rows,
  onChange,
  columns,
  newRow,
}: {
  title: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  columns: ColumnDef[];
  newRow: () => T;
}) {
  function updateRow(index: number, key: string, value: string | number | boolean) {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  return (
    <Section title={title}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400">
              {columns.map((col) => (
                <th key={col.key} className="px-2 py-2 font-medium">
                  {col.label}
                </th>
              ))}
              <th className="px-2 py-2">Aktivní</th>
              <th className="px-2 py-2">Pořadí</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.id ?? index)} className="border-t border-slate-800">
                {columns.map((col) => (
                  <td key={col.key} className="px-2 py-2">
                    <input
                      type={col.type === "number" ? "number" : "text"}
                      step={col.type === "number" ? "0.1" : undefined}
                      className={inputClass}
                      value={String(row[col.key] ?? "")}
                      onChange={(e) =>
                        updateRow(
                          index,
                          col.key,
                          col.type === "number" ? Number(e.target.value) : e.target.value
                        )
                      }
                    />
                  </td>
                ))}
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={row.aktivni !== false}
                    onChange={(e) => updateRow(index, "aktivni", e.target.checked)}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    className={inputClass}
                    value={Number(row.poradi ?? index + 1)}
                    onChange={(e) => updateRow(index, "poradi", Number(e.target.value))}
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="text-xs text-red-300"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="mt-3 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
        onClick={() => onChange([...rows, newRow()])}
      >
        + Přidat řádek
      </button>
    </Section>
  );
}

function PresetTable({
  title,
  rows,
  setupy,
  oblast,
  onChange,
}: {
  title: string;
  rows: PortalSestavaKatalog["zvuk_presety"];
  setupy: Array<{ setup_id: string; nazev: string }>;
  oblast: "sound" | "lights";
  onChange: (rows: PortalSestavaKatalog["zvuk_presety"]) => void;
}) {
  function updateRow(index: number, patch: Partial<PortalSestavaKatalog["zvuk_presety"][number]>) {
    const next = [...rows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <Section title={title}>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.kod}-${index}`} className="grid gap-2 rounded-lg border border-slate-800 p-3 lg:grid-cols-6">
            <TextField label="Kód" value={row.kod} onChange={(v) => updateRow(index, { kod: v as typeof row.kod })} />
            <TextField label="Název" value={row.nazev} onChange={(v) => updateRow(index, { nazev: v })} />
            <label className="space-y-1 lg:col-span-2">
              <span className={labelClass}>Setup</span>
              <select
                className={inputClass}
                value={row.setup_id ?? ""}
                onChange={(e) => updateRow(index, { setup_id: e.target.value || null })}
              >
                <option value="">— bez vazby —</option>
                {setupy.map((setup) => (
                  <option key={setup.setup_id} value={setup.setup_id}>
                    {setup.nazev}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={row.aktivni !== false}
                onChange={(e) => updateRow(index, { aktivni: e.target.checked })}
              />
              Aktivní
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Pořadí</span>
              <input
                type="number"
                className={inputClass}
                value={row.poradi ?? index + 1}
                onChange={(e) => updateRow(index, { poradi: Number(e.target.value) })}
              />
            </label>
            <button
              type="button"
              className="text-left text-xs text-red-300 lg:col-span-6"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              Smazat preset
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
        onClick={() =>
          onChange([
            ...rows,
            {
              kod: "mala",
              nazev: "Nový preset",
              oblast,
              setup_id: null,
              aktivni: true,
              poradi: rows.length + 1,
            },
          ])
        }
      >
        + Přidat preset
      </button>
    </Section>
  );
}

function LedTable({
  rows,
  skladPolozky,
  onChange,
}: {
  rows: PortalSestavaKatalog["led_typy"];
  skladPolozky: Array<{ skladova_polozka_id: string; nazev: string }>;
  onChange: (rows: PortalSestavaKatalog["led_typy"]) => void;
}) {
  function updateRow(index: number, patch: Partial<PortalSestavaKatalog["led_typy"][number]>) {
    const next = [...rows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <Section title="LED varianty">
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div key={row.kod} className="rounded-lg border border-slate-800 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-white">{row.nazev || row.kod}</div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.aktivni !== false}
                    onChange={(e) => updateRow(index, { aktivni: e.target.checked })}
                  />
                  Aktivní
                </label>
                <label className="flex items-center gap-2">
                  Pořadí
                  <input
                    type="number"
                    className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    value={row.poradi ?? index + 1}
                    onChange={(e) => updateRow(index, { poradi: Number(e.target.value) })}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-red-300"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                >
                  Smazat
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <TextField label="Kód" value={row.kod} onChange={(v) => updateRow(index, { kod: v as typeof row.kod })} />
              <TextField label="Název" value={row.nazev} onChange={(v) => updateRow(index, { nazev: v })} />
              <TextField label="Pitch" value={row.pixel_pitch} onChange={(v) => updateRow(index, { pixel_pitch: v })} />
              <label className="space-y-1">
                <span className={labelClass}>Prostředí</span>
                <select
                  className={inputClass}
                  value={row.prostredi}
                  onChange={(e) =>
                    updateRow(index, { prostredi: e.target.value as "indoor" | "outdoor" })
                  }
                >
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              </label>
              <NumberField label="Panel šířka" value={row.panel_sirka_m} onChange={(v) => updateRow(index, { panel_sirka_m: v })} />
              <NumberField label="Panel výška" value={row.panel_vyska_m} onChange={(v) => updateRow(index, { panel_vyska_m: v })} />
              <NumberField label="Max plocha m²" value={row.max_plocha_m2} onChange={(v) => updateRow(index, { max_plocha_m2: v })} />
              <NumberField label="Default šířka" value={row.default_sirka_m} onChange={(v) => updateRow(index, { default_sirka_m: v })} />
              <NumberField label="Default výška" value={row.default_vyska_m} onChange={(v) => updateRow(index, { default_vyska_m: v })} />
              <label className="space-y-1 sm:col-span-2">
                <span className={labelClass}>Skladová položka (LED panel)</span>
                <select
                  className={inputClass}
                  value={row.sklad_polozka_id ?? ""}
                  onChange={(e) =>
                    updateRow(index, { sklad_polozka_id: e.target.value || null })
                  }
                >
                  <option value="">— bez vazby —</option>
                  {skladPolozky.map((polozka) => (
                    <option key={polozka.skladova_polozka_id} value={polozka.skladova_polozka_id}>
                      {polozka.nazev}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={row.je_mantinel}
                  onChange={(e) => updateRow(index, { je_mantinel: e.target.checked })}
                />
                Mantinel
              </label>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
        onClick={() =>
          onChange([
            ...rows,
            {
              kod: "p3_9_outdoor",
              nazev: "Nový LED typ",
              pixel_pitch: "P3,9",
              prostredi: "outdoor",
              panel_sirka_m: 1,
              panel_vyska_m: 0.5,
              panel_plocha_m2: 0.5,
              je_mantinel: false,
              podporuje_rohy: true,
              sklad_polozka_id: null,
              dostupnych_panelu: 0,
              max_plocha_m2: 10,
              default_sirka_m: 6,
              default_vyska_m: 3,
              aktivni: true,
              poradi: rows.length + 1,
            },
          ])
        }
      >
        + Přidat LED variantu
      </button>
    </Section>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className={labelClass}>{label}</span>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        step="0.01"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
