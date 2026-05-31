"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createPoptavkaAction, updatePoptavkaAction } from "@/app/portal/poptavky/actions";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import { SETUP_OBLAST_LABELS } from "@/lib/client-portal/labels";
import {
  TYP_AKCE_OPTIONS,
  type PoptavkaFormValues,
  type PoptavkaPrefill,
  type PoptavkaSetupInput,
} from "@/lib/client-portal/poptavka-form";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";
import { SETUP_OBLASTI, type SetupOblast } from "@/lib/client-portal/types";

const ERROR_MESSAGES: Record<string, string> = {
  missing_contact: "Vyplňte kontaktní osobu.",
  missing_email: "Vyplňte e-mail.",
  missing_event_name: "Vyplňte název akce.",
  missing_location: "Vyplňte místo nebo adresu akce.",
  missing_date_from: "Vyplňte datum začátku akce.",
  missing_date_to: "Vyplňte datum konce akce.",
  invalid_date_range: "Datum konce musí být stejné nebo pozdější než začátek.",
  save_failed: "Poptávku se nepodařilo uložit.",
  setups_failed: "Základ poptávky byl uložen, ale setupy se nepodařilo zapsat.",
  not_editable: "Tuto poptávku už nelze upravovat.",
  not_found: "Poptávka nenalezena.",
};

type Props = {
  mode: "create" | "edit";
  prefill: PoptavkaPrefill;
  setupsByOblast: PortalSetupsByOblast;
  initialValues?: Partial<PoptavkaFormValues>;
  poptavkaId?: string;
  readOnly?: boolean;
  errorCode?: string | null;
  saved?: boolean;
};

const STEPS = [
  { id: 1, title: "Kdo zadává" },
  { id: 2, title: "Kde a kdy" },
  { id: 3, title: "Setupy" },
] as const;

function setupDescription(setup: {
  portal_popis: string | null;
  popis: string | null;
}) {
  return setup.portal_popis?.trim() || setup.popis?.trim() || "";
}

function emptySetupMap(): Record<string, PoptavkaSetupInput> {
  return {};
}

export default function PoptavkaFormClient({
  mode,
  prefill,
  setupsByOblast,
  initialValues,
  poptavkaId,
  readOnly = false,
  errorCode,
  saved,
}: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<PoptavkaFormValues>({
    kontakt_jmeno: initialValues?.kontakt_jmeno ?? prefill.kontakt_jmeno,
    kontakt_telefon: initialValues?.kontakt_telefon ?? prefill.kontakt_telefon,
    kontakt_email: initialValues?.kontakt_email ?? prefill.kontakt_email,
    misto_nazev: initialValues?.misto_nazev ?? "",
    typ_akce: initialValues?.typ_akce ?? "",
    misto_adresa: initialValues?.misto_adresa ?? "",
    datum_od: initialValues?.datum_od ?? "",
    datum_do: initialValues?.datum_do ?? "",
    cas_programu_od: initialValues?.cas_programu_od ?? "",
    cas_programu_do: initialValues?.cas_programu_do ?? "",
    misto_poznamka: initialValues?.misto_poznamka ?? "",
    setupy: initialValues?.setupy ?? [],
  });

  const [selectedSetups, setSelectedSetups] = useState<Record<string, PoptavkaSetupInput>>(
    () => {
      const map = emptySetupMap();
      for (const row of initialValues?.setupy ?? []) {
        map[row.setup_id] = row;
      }
      return map;
    }
  );

  const setupyJson = useMemo(
    () => JSON.stringify(Object.values(selectedSetups)),
    [selectedSetups]
  );

  const title =
    mode === "create" ? "Nová poptávka" : readOnly ? "Detail poptávky" : "Upravit poptávku";

  function updateField<K extends keyof PoptavkaFormValues>(key: K, value: PoptavkaFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleSetup(setupId: string, checked: boolean) {
    setSelectedSetups((current) => {
      const next = { ...current };
      if (checked) {
        next[setupId] = {
          setup_id: setupId,
          mnozstvi: current[setupId]?.mnozstvi ?? 1,
          poznamka_klienta: current[setupId]?.poznamka_klienta ?? null,
        };
      } else {
        delete next[setupId];
      }
      return next;
    });
  }

  function updateSetupField(
    setupId: string,
    field: "mnozstvi" | "poznamka_klienta",
    value: string
  ) {
    setSelectedSetups((current) => {
      const row = current[setupId];
      if (!row) return current;
      return {
        ...current,
        [setupId]: {
          ...row,
          [field]:
            field === "mnozstvi"
              ? Math.max(1, Math.floor(Number(value) || 1))
              : value.trim() || null,
        },
      };
    });
  }

  async function handleSubmit() {
    if (readOnly) return;
    setSubmitting(true);
  }

  const formAction = mode === "create" ? createPoptavkaAction : updatePoptavkaAction;

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";
  const labelClass = "text-sm font-medium text-slate-300";

  return (
    <PortalShell showBackToPortal>
      <PortalCard title={title}>
        {saved ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Poptávka byla uložena jako koncept.
          </p>
        ) : null}
        {errorCode && ERROR_MESSAGES[errorCode] ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {ERROR_MESSAGES[errorCode]}
          </p>
        ) : null}

        {!readOnly ? (
          <div className="mb-8 flex flex-wrap gap-2">
            {STEPS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(item.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  step === item.id
                    ? "bg-amber-500/25 text-amber-50 ring-1 ring-amber-500/50"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                {item.id}. {item.title}
              </button>
            ))}
          </div>
        ) : null}

        <form action={formAction} onSubmit={handleSubmit} className="space-y-8">
          {mode === "edit" && poptavkaId ? (
            <input type="hidden" name="poptavka_id" value={poptavkaId} />
          ) : null}
          <input type="hidden" name="setupy_json" value={setupyJson} readOnly />

          {(readOnly || step === 1) && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-white">1. Kdo zadává</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className={labelClass}>Firma</span>
                  <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200">
                    {prefill.firma_nazev || "—"}
                  </p>
                </div>
                <div className="space-y-2">
                  <span className={labelClass}>IČO</span>
                  <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200">
                    {prefill.firma_ico || "—"}
                  </p>
                </div>
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>Kontaktní osoba *</span>
                <input
                  name="kontakt_jmeno"
                  value={form.kontakt_jmeno}
                  onChange={(e) => updateField("kontakt_jmeno", e.target.value)}
                  disabled={readOnly}
                  required
                  className={inputClass}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>Telefon</span>
                  <input
                    name="kontakt_telefon"
                    value={form.kontakt_telefon}
                    onChange={(e) => updateField("kontakt_telefon", e.target.value)}
                    disabled={readOnly}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>E-mail *</span>
                  <input
                    name="kontakt_email"
                    type="email"
                    value={form.kontakt_email}
                    onChange={(e) => updateField("kontakt_email", e.target.value)}
                    disabled={readOnly}
                    required
                    className={inputClass}
                  />
                </label>
              </div>
            </section>
          )}

          {(readOnly || step === 2) && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-white">2. Kde a kdy</h2>

              <label className="block space-y-2">
                <span className={labelClass}>Název akce *</span>
                <input
                  name="misto_nazev"
                  value={form.misto_nazev}
                  onChange={(e) => updateField("misto_nazev", e.target.value)}
                  disabled={readOnly}
                  required
                  className={inputClass}
                />
              </label>

              <label className="block space-y-2">
                <span className={labelClass}>Typ akce</span>
                <select
                  name="typ_akce"
                  value={form.typ_akce}
                  onChange={(e) => updateField("typ_akce", e.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                >
                  <option value="">Vyberte typ</option>
                  {TYP_AKCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className={labelClass}>Místo / adresa / obec *</span>
                <input
                  name="misto_adresa"
                  value={form.misto_adresa}
                  onChange={(e) => updateField("misto_adresa", e.target.value)}
                  disabled={readOnly}
                  required
                  className={inputClass}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>Datum od *</span>
                  <input
                    name="datum_od"
                    type="date"
                    value={form.datum_od}
                    onChange={(e) => updateField("datum_od", e.target.value)}
                    disabled={readOnly}
                    required
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Datum do *</span>
                  <input
                    name="datum_do"
                    type="date"
                    value={form.datum_do}
                    onChange={(e) => updateField("datum_do", e.target.value)}
                    disabled={readOnly}
                    required
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>Čas programu od</span>
                  <input
                    name="cas_programu_od"
                    type="time"
                    value={form.cas_programu_od}
                    onChange={(e) => updateField("cas_programu_od", e.target.value)}
                    disabled={readOnly}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Čas programu do</span>
                  <input
                    name="cas_programu_do"
                    type="time"
                    value={form.cas_programu_do}
                    onChange={(e) => updateField("cas_programu_do", e.target.value)}
                    disabled={readOnly}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>Poznámka k místu</span>
                <textarea
                  name="misto_poznamka"
                  value={form.misto_poznamka}
                  onChange={(e) => updateField("misto_poznamka", e.target.value)}
                  disabled={readOnly}
                  rows={3}
                  className={inputClass}
                />
              </label>
            </section>
          )}

          {(readOnly || step === 3) && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white">3. Výběr setupů</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Vyberte požadované setupy a zadejte množství. Skladové položky ani rozměry
                  stage zadávat nemusíte.
                </p>
              </div>

              {SETUP_OBLASTI.map((oblast: SetupOblast) => {
                const rows = setupsByOblast[oblast];
                if (!rows.length) return null;

                return (
                  <div key={oblast} className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-amber-200/90">
                      {SETUP_OBLAST_LABELS[oblast]}
                    </h3>
                    <div className="space-y-3">
                      {rows.map((setup) => {
                        const selected = selectedSetups[setup.setup_id];
                        const description = setupDescription(setup);

                        return (
                          <div
                            key={setup.setup_id}
                            className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                          >
                            <div className="flex items-start gap-3">
                              {!readOnly ? (
                                <input
                                  type="checkbox"
                                  checked={Boolean(selected)}
                                  onChange={(e) =>
                                    toggleSetup(setup.setup_id, e.target.checked)
                                  }
                                  className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950"
                                />
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-white">{setup.nazev}</div>
                                {description ? (
                                  <p className="mt-1 text-sm text-slate-400">{description}</p>
                                ) : null}

                                {(selected || readOnly) && selected ? (
                                  <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
                                    <label className="block space-y-1">
                                      <span className="text-xs text-slate-500">Množství</span>
                                      <input
                                        type="number"
                                        min={1}
                                        value={selected.mnozstvi}
                                        onChange={(e) =>
                                          updateSetupField(
                                            setup.setup_id,
                                            "mnozstvi",
                                            e.target.value
                                          )
                                        }
                                        disabled={readOnly}
                                        className={inputClass}
                                      />
                                    </label>
                                    <label className="block space-y-1">
                                      <span className="text-xs text-slate-500">
                                        Poznámka k setupu
                                      </span>
                                      <input
                                        value={selected.poznamka_klienta ?? ""}
                                        onChange={(e) =>
                                          updateSetupField(
                                            setup.setup_id,
                                            "poznamka_klienta",
                                            e.target.value
                                          )
                                        }
                                        disabled={readOnly}
                                        className={inputClass}
                                      />
                                    </label>
                                  </div>
                                ) : null}

                                {readOnly && !selected ? null : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
            {!readOnly && step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((current) => current - 1)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
              >
                ← Zpět
              </button>
            ) : null}

            {!readOnly && step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((current) => current + 1)}
                className="rounded-xl border border-amber-500/60 bg-amber-500/20 px-5 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30"
              >
                Pokračovat →
              </button>
            ) : null}

            {!readOnly && step === 3 ? (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl border border-amber-500/60 bg-amber-500/20 px-5 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30 disabled:opacity-60"
              >
                {submitting
                  ? "Ukládám…"
                  : mode === "create"
                    ? "Uložit koncept"
                    : "Uložit změny"}
              </button>
            ) : null}

            <Link
              href="/portal/poptavky"
              className="text-sm font-medium text-slate-400 transition hover:text-slate-200"
            >
              ← Seznam poptávek
            </Link>
          </div>
        </form>
      </PortalCard>
    </PortalShell>
  );
}
