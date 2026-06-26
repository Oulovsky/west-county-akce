"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createPoptavkaAction,
  updatePoptavkaAction,
} from "@/app/portal/poptavky/actions";
import PoptavkaFotkyClient from "@/components/portal/PoptavkaFotkyClient";
import { emptyLogistikaOknaValues } from "@/lib/logistika-okna";
import PoptavkaLogistikaOknaPanel from "@/components/portal/PoptavkaLogistikaOknaPanel";
import PoptavkaMistoKnowHowPanel from "@/components/portal/PoptavkaMistoKnowHowPanel";
import PoptavkaSestavaKonfigurator from "@/components/portal/PoptavkaSestavaKonfigurator";
import PoptavkaSubmitButton from "@/components/portal/PoptavkaSubmitButton";
import { PortalCard, PortalShell } from "@/components/portal/PortalShell";
import {
  TYP_AKCE_OPTIONS,
  type PoptavkaFormValues,
  type PoptavkaPrefill,
  type PoptavkaSetupInput,
} from "@/lib/client-portal/poptavka-form";
import type { ClientPortalMistoSummary, ClientPortalMistoKnowHow } from "@/lib/client-portal/client-mista-shared";
import type { PoptavkaFotkaWithUrl } from "@/lib/client-portal/poptavka-fotky-server";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";
import {
  ELEKTRO_ZASUVKA_OPTIONS,
  EMPTY_POPTAVKA_TECHNIKA,
  TRIZVOLBA_OPTIONS,
  type PoptavkaTechnikaFormValues,
} from "@/lib/client-portal/poptavka-technika-form";
import {
  EMPTY_SESTAVA_KONFIGURATOR,
  deriveSetupSelectionsFromSestava,
} from "@/lib/client-portal/sestava-konfigurator-form";
import type {
  PortalSestavaKatalog,
  SestavaKonfiguratorState,
} from "@/lib/client-portal/sestava-konfigurator-types";

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
  submit_incomplete: "Doplňte kontakt, název akce a termín před odesláním.",
  submit_failed: "Odeslání se nezdařilo.",
  invalid_misto:
    "Vybrané místo není dostupné pro váš účet. Vyberte jiné místo nebo zadejte nové.",
  missing_saved_misto: "Vyberte uložené místo, nebo přepněte na Nové místo.",
  invalid_setups:
    "Vybrané setupy už nejsou v portálu dostupné. Upravte výběr techniky a uložte znovu.",
  invalid_sestava:
    "Konfigurace sestavy obsahuje chyby. Doplňte povinné volby ve kroku Konfigurace sestavy.",
  invalid_logistika_okna:
    "Časové okno stavby nebo bourání není platné. Konec okna musí být po začátku.",
};

type Props = {
  mode: "create" | "edit";
  prefill: PoptavkaPrefill;
  setupsByOblast: PortalSetupsByOblast;
  savedMista?: ClientPortalMistoSummary[];
  savedMistaKnowHowById?: Record<string, ClientPortalMistoKnowHow>;
  sestavaKatalog: PortalSestavaKatalog;
  initialSestava?: SestavaKonfiguratorState;
  initialValues?: Partial<PoptavkaFormValues>;
  initialTechnika?: PoptavkaTechnikaFormValues;
  initialFotky?: PoptavkaFotkaWithUrl[];
  poptavkaId?: string;
  readOnly?: boolean;
  errorCode?: string | null;
  saved?: boolean;
  submitted?: boolean;
  revisionNote?: string | null;
};

const CREATE_STEPS = [
  { id: 1, title: "Kdo zadává" },
  { id: 2, title: "Kde a kdy" },
  { id: 3, title: "Konfigurace sestavy" },
] as const;

const EDIT_STEPS = [
  ...CREATE_STEPS,
  { id: 4, title: "Technika místa" },
  { id: 5, title: "Fotky" },
] as const;

function emptySetupMap(): Record<string, PoptavkaSetupInput> {
  return {};
}

function formatSavedMistoLabel(misto: ClientPortalMistoSummary) {
  if (misto.adresa_text?.trim()) {
    return `${misto.nazev} — ${misto.adresa_text.trim()}`;
  }
  return misto.nazev;
}

export default function PoptavkaFormClient({
  mode,
  prefill,
  setupsByOblast,
  savedMista = [],
  savedMistaKnowHowById = {},
  sestavaKatalog,
  initialSestava,
  initialValues,
  initialTechnika,
  initialFotky = [],
  poptavkaId,
  readOnly = false,
  errorCode,
  saved,
  submitted,
  revisionNote,
}: Props) {
  const steps = mode === "create" ? CREATE_STEPS : EDIT_STEPS;
  const maxStep = steps.length;
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
    misto_source:
      initialValues?.misto_source ??
      (initialValues?.misto_id ? "saved" : "new"),
    misto_id: initialValues?.misto_id ?? null,
    misto_lat: initialValues?.misto_lat ?? null,
    misto_lng: initialValues?.misto_lng ?? null,
    setupy: initialValues?.setupy ?? [],
    ...emptyLogistikaOknaValues(),
    stavba_okno_od: initialValues?.stavba_okno_od ?? "",
    stavba_okno_do: initialValues?.stavba_okno_do ?? "",
    bourani_okno_od: initialValues?.bourani_okno_od ?? "",
    bourani_okno_do: initialValues?.bourani_okno_do ?? "",
    logistika_poznamka_klienta: initialValues?.logistika_poznamka_klienta ?? "",
  });

  const [technika, setTechnika] = useState<PoptavkaTechnikaFormValues>({
    ...EMPTY_POPTAVKA_TECHNIKA,
    ...initialTechnika,
  });

  const [sestava, setSestava] = useState<SestavaKonfiguratorState>({
    ...EMPTY_SESTAVA_KONFIGURATOR,
    ...initialSestava,
  });

  const sestavaJson = useMemo(() => JSON.stringify(sestava), [sestava]);

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

  useEffect(() => {
    if (sestava.rezim === "atypicka" || !sestava.stage_typ) return;
    const derived = deriveSetupSelectionsFromSestava(sestava, sestavaKatalog, setupsByOblast);
    if (derived.length === 0) return;
    setSelectedSetups((current) => {
      const next = { ...current };
      for (const row of derived) {
        if (!next[row.setup_id]) {
          next[row.setup_id] = row;
        }
      }
      return next;
    });
  }, [sestava, sestavaKatalog, setupsByOblast]);

  const title =
    mode === "create" ? "Nová poptávka" : readOnly ? "Detail poptávky" : "Upravit poptávku";

  function updateField<K extends keyof PoptavkaFormValues>(key: K, value: PoptavkaFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateLogistikaField(
    key:
      | "stavba_okno_od"
      | "stavba_okno_do"
      | "bourani_okno_od"
      | "bourani_okno_do"
      | "logistika_poznamka_klienta",
    value: string
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function switchToNewMisto() {
    setForm((current) => {
      if (current.misto_source === "new") return current;
      return {
        ...current,
        misto_source: "new",
        misto_id: null,
        misto_lat: null,
        misto_lng: null,
      };
    });
  }

  function switchToSavedMisto() {
    setForm((current) => {
      if (current.misto_source === "saved") return current;
      return {
        ...current,
        misto_source: "saved",
        misto_id: null,
        misto_lat: null,
        misto_lng: null,
      };
    });
  }

  function selectSavedMisto(mistoId: string) {
    const misto = savedMista.find((row) => row.misto_id === mistoId);
    if (!misto) return;

    setForm((current) => ({
      ...current,
      misto_source: "saved",
      misto_id: misto.misto_id,
      misto_adresa: misto.adresa_text?.trim() ?? "",
      misto_lat: misto.lat,
      misto_lng: misto.lng,
      misto_poznamka: misto.poznamka?.trim() ?? "",
    }));
  }

  const hasSavedMista = savedMista.length > 0;

  function isSavedMistoInList(mistoId: string | null | undefined) {
    return Boolean(mistoId && savedMista.some((misto) => misto.misto_id === mistoId));
  }

  const showStaleSavedMistoWarning =
    form.misto_source === "saved" &&
    ((Boolean(form.misto_id) && !isSavedMistoInList(form.misto_id)) ||
      (!form.misto_id &&
        initialValues?.misto_source === "saved" &&
        Boolean(initialValues?.misto_id) &&
        !isSavedMistoInList(initialValues.misto_id)));

  const showSavedMistoPickHint =
    form.misto_source === "saved" && hasSavedMista && !form.misto_id && !showStaleSavedMistoWarning;

  const selectedMistoKnowHow: ClientPortalMistoKnowHow | null =
    form.misto_source === "saved" && isSavedMistoInList(form.misto_id)
      ? (savedMistaKnowHowById[form.misto_id!] ?? { poznamky: [], fotky: [] })
      : null;

  function updateTechnikaField<K extends keyof PoptavkaTechnikaFormValues>(
    key: K,
    value: PoptavkaTechnikaFormValues[K]
  ) {
    setTechnika((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (readOnly) return;
    setSubmitting(true);
  }

  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.tagName === "TEXTAREA") return;
    if (target instanceof HTMLButtonElement && target.type === "submit") return;
    if (target.tagName === "INPUT" || target.tagName === "SELECT") {
      event.preventDefault();
    }
  }

  const formAction = mode === "create" ? createPoptavkaAction : updatePoptavkaAction;

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";
  const labelClass = "text-sm font-medium text-slate-300";

  const optionCardClass =
    "flex gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-200";

  return (
    <PortalShell showBackToPortal showMainNav>
      <PortalCard title={title}>
        {revisionNote ? (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <span className="font-semibold">Poznámka k doplnění:</span> {revisionNote}
          </p>
        ) : null}
        {submitted ? (
          <p className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            Poptávka byla odeslána a čeká na kontrolu WEST COUNTY.
          </p>
        ) : null}
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
            {steps.map((item) => (
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

        <form
          action={formAction}
          onSubmit={handleSubmit}
          onKeyDown={handleFormKeyDown}
          className="space-y-8"
        >
          {mode === "edit" && poptavkaId ? (
            <input type="hidden" name="poptavka_id" value={poptavkaId} />
          ) : null}
          <input type="hidden" name="setupy_json" value={setupyJson} readOnly />
          <input type="hidden" name="sestava_konfigurator_json" value={sestavaJson} readOnly />
          <input type="hidden" name="misto_source" value={form.misto_source} readOnly />
          <input type="hidden" name="misto_id" value={form.misto_id ?? ""} readOnly />
          <input
            type="hidden"
            name="misto_lat"
            value={form.misto_lat != null ? String(form.misto_lat) : ""}
            readOnly
          />
          <input
            type="hidden"
            name="misto_lng"
            value={form.misto_lng != null ? String(form.misto_lng) : ""}
            readOnly
          />

          {!readOnly && step !== 1 ? (
            <>
              <input type="hidden" name="kontakt_jmeno" value={form.kontakt_jmeno} readOnly />
              <input type="hidden" name="kontakt_telefon" value={form.kontakt_telefon} readOnly />
              <input type="hidden" name="kontakt_email" value={form.kontakt_email} readOnly />
            </>
          ) : null}

          {!readOnly && step !== 2 ? (
            <>
              <input type="hidden" name="misto_nazev" value={form.misto_nazev} readOnly />
              <input type="hidden" name="typ_akce" value={form.typ_akce} readOnly />
              <input type="hidden" name="misto_adresa" value={form.misto_adresa} readOnly />
              <input type="hidden" name="datum_od" value={form.datum_od} readOnly />
              <input type="hidden" name="datum_do" value={form.datum_do} readOnly />
              <input type="hidden" name="cas_programu_od" value={form.cas_programu_od} readOnly />
              <input type="hidden" name="cas_programu_do" value={form.cas_programu_do} readOnly />
              <input type="hidden" name="misto_poznamka" value={form.misto_poznamka} readOnly />
              <input type="hidden" name="stavba_okno_od" value={form.stavba_okno_od} readOnly />
              <input type="hidden" name="stavba_okno_do" value={form.stavba_okno_do} readOnly />
              <input type="hidden" name="bourani_okno_od" value={form.bourani_okno_od} readOnly />
              <input type="hidden" name="bourani_okno_do" value={form.bourani_okno_do} readOnly />
              <input
                type="hidden"
                name="logistika_poznamka_klienta"
                value={form.logistika_poznamka_klienta}
                readOnly
              />
            </>
          ) : null}

          {mode === "edit" && !readOnly && step !== 4 ? (
            <>
              <input type="hidden" name="prijezd_poznamka" value={technika.prijezd_poznamka} readOnly />
              <input
                type="hidden"
                name="parkovani_poznamka"
                value={technika.parkovani_poznamka}
                readOnly
              />
              <input
                type="hidden"
                name="rozvadece_poznamka"
                value={technika.rozvadece_poznamka}
                readOnly
              />
              <input type="hidden" name="elektro_pripojka" value={technika.elektro_pripojka} readOnly />
              <input type="hidden" name="elektro_jisteni" value={technika.elektro_jisteni} readOnly />
              <input type="hidden" name="elektro_zasuvka" value={technika.elektro_zasuvka} readOnly />
              <input
                type="hidden"
                name="elektro_vzdalenost_m"
                value={technika.elektro_vzdalenost_m}
                readOnly
              />
              <input type="hidden" name="kabelove_trasy" value={technika.kabelove_trasy} readOnly />
              <input type="hidden" name="misto_stage" value={technika.misto_stage} readOnly />
              <input type="hidden" name="misto_foh" value={technika.misto_foh} readOnly />
              <input type="hidden" name="omezeni_hluku" value={technika.omezeni_hluku} readOnly />
              <input type="hidden" name="casova_omezeni" value={technika.casova_omezeni} readOnly />
              <input type="hidden" name="dalsi_poznamky" value={technika.dalsi_poznamky} readOnly />
              <input type="hidden" name="lze_zajet_autem" value={technika.lze_zajet_autem} readOnly />
              <input
                type="hidden"
                name="kabel_pres_silnici"
                value={technika.kabel_pres_silnici}
                readOnly
              />
              {technika.pozadovan_vyjezd_technika ? (
                <input type="hidden" name="pozadovan_vyjezd_technika" value="on" readOnly />
              ) : null}
            </>
          ) : null}

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

              {hasSavedMista ? (
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <span className={labelClass}>Místo konání</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className={optionCardClass}>
                      <input
                        type="radio"
                        name="misto_source_ui"
                        checked={form.misto_source === "new"}
                        onChange={switchToNewMisto}
                        disabled={readOnly}
                      />
                      <span>Nové místo</span>
                    </label>
                    <label className={optionCardClass}>
                      <input
                        type="radio"
                        name="misto_source_ui"
                        checked={form.misto_source === "saved"}
                        onChange={switchToSavedMisto}
                        disabled={readOnly}
                      />
                      <span>Vybrat uložené místo</span>
                    </label>
                  </div>

                  {form.misto_source === "saved" ? (
                    <label className="block space-y-2">
                      <span className="text-sm text-slate-400">Uložené místo</span>
                      <select
                        value={form.misto_id ?? ""}
                        onChange={(e) => selectSavedMisto(e.target.value)}
                        disabled={readOnly}
                        className={inputClass}
                      >
                        <option value="">Vyberte místo</option>
                        {savedMista.map((misto) => (
                          <option key={misto.misto_id} value={misto.misto_id}>
                            {formatSavedMistoLabel(misto)}
                          </option>
                        ))}
                      </select>
                      {showStaleSavedMistoWarning ? (
                        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          Místo uložené u této poptávky už není dostupné pro váš účet. Vyberte jiné
                          uložené místo nebo přepněte na Nové místo.
                        </p>
                      ) : null}
                      {showSavedMistoPickHint ? (
                        <p className="text-xs text-amber-200/90">Vyberte místo ze seznamu.</p>
                      ) : null}
                      <p className="text-xs text-slate-500">
                        Adresa a poznámka se předvyplní z uloženého místa. Můžete je upravit pro
                        tuto konkrétní akci.
                      </p>
                      {form.misto_id ? (
                        <PoptavkaMistoKnowHowPanel knowHow={selectedMistoKnowHow} />
                      ) : null}
                    </label>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Zatím nemáte žádné uložené místo. Vytvoří se po první zpracované akci.
                </p>
              )}

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

              <PoptavkaLogistikaOknaPanel
                mode="edit"
                values={{
                  stavba_okno_od: form.stavba_okno_od,
                  stavba_okno_do: form.stavba_okno_do,
                  bourani_okno_od: form.bourani_okno_od,
                  bourani_okno_do: form.bourani_okno_do,
                  logistika_poznamka_klienta: form.logistika_poznamka_klienta,
                }}
                readOnly={readOnly}
                onChange={updateLogistikaField}
              />
            </section>
          )}

          {(readOnly || step === 3) && (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">3. Konfigurace sestavy</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Poskládejte stage, pódium, LED, zvuk a světla. Volby vycházejí z našich
                  sestav — schéma se aktualizuje podle vašich voleb.
                </p>
              </div>
              <PoptavkaSestavaKonfigurator
                katalog={sestavaKatalog}
                setupsByOblast={setupsByOblast}
                state={sestava}
                onChange={setSestava}
                readOnly={readOnly}
                inputClass={inputClass}
                labelClass={labelClass}
                optionCardClass={optionCardClass}
              />
            </section>
          )}

          {mode === "edit" && (readOnly || step === 4) && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-white">4. Technické údaje místa</h2>

              <label className="block space-y-2">
                <span className={labelClass}>Poznámka k příjezdu</span>
                <textarea
                  name="prijezd_poznamka"
                  value={technika.prijezd_poznamka}
                  onChange={(e) => updateTechnikaField("prijezd_poznamka", e.target.value)}
                  disabled={readOnly}
                  rows={3}
                  className={inputClass}
                  placeholder="Vjezd, brána, omezení pro dodávku…"
                />
              </label>

              <div>
                <span className={labelClass}>Lze zajet dodávkou až k místu?</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {TRIZVOLBA_OPTIONS.map(([value, label]) => (
                    <label key={value} className={optionCardClass}>
                      <input
                        type="radio"
                        name="lze_zajet_autem"
                        value={value}
                        checked={technika.lze_zajet_autem === value}
                        onChange={() => updateTechnikaField("lze_zajet_autem", value)}
                        disabled={readOnly}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>Parkování</span>
                <textarea
                  name="parkovani_poznamka"
                  value={technika.parkovani_poznamka}
                  onChange={(e) => updateTechnikaField("parkovani_poznamka", e.target.value)}
                  disabled={readOnly}
                  rows={2}
                  className={inputClass}
                />
              </label>

              <label className="block space-y-2">
                <span className={labelClass}>Rozvaděče / elektro na místě</span>
                <textarea
                  name="rozvadece_poznamka"
                  value={technika.rozvadece_poznamka}
                  onChange={(e) => updateTechnikaField("rozvadece_poznamka", e.target.value)}
                  disabled={readOnly}
                  rows={2}
                  className={inputClass}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>Přípojka / proud</span>
                  <input
                    name="elektro_pripojka"
                    value={technika.elektro_pripojka}
                    onChange={(e) => updateTechnikaField("elektro_pripojka", e.target.value)}
                    disabled={readOnly}
                    className={inputClass}
                    placeholder="Např. 32A, 63A"
                  />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Jištění / okruhy</span>
                  <input
                    name="elektro_jisteni"
                    value={technika.elektro_jisteni}
                    onChange={(e) => updateTechnikaField("elektro_jisteni", e.target.value)}
                    disabled={readOnly}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>Typ zásuvky</span>
                  <select
                    name="elektro_zasuvka"
                    value={technika.elektro_zasuvka}
                    onChange={(e) => updateTechnikaField("elektro_zasuvka", e.target.value)}
                    disabled={readOnly}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {ELEKTRO_ZASUVKA_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Vzdálenost elektřiny (m)</span>
                  <input
                    name="elektro_vzdalenost_m"
                    inputMode="decimal"
                    value={technika.elektro_vzdalenost_m}
                    onChange={(e) => updateTechnikaField("elektro_vzdalenost_m", e.target.value)}
                    disabled={readOnly}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>Kabelové trasy</span>
                <textarea
                  name="kabelove_trasy"
                  value={technika.kabelove_trasy}
                  onChange={(e) => updateTechnikaField("kabelove_trasy", e.target.value)}
                  disabled={readOnly}
                  rows={2}
                  className={inputClass}
                />
              </label>

              <div>
                <span className={labelClass}>Kabel přes silnici / veřejný průchod?</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {TRIZVOLBA_OPTIONS.map(([value, label]) => (
                    <label key={value} className={optionCardClass}>
                      <input
                        type="radio"
                        name="kabel_pres_silnici"
                        value={value}
                        checked={technika.kabel_pres_silnici === value}
                        onChange={() => updateTechnikaField("kabel_pres_silnici", value)}
                        disabled={readOnly}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>Místo pro stage</span>
                  <textarea
                    name="misto_stage"
                    value={technika.misto_stage}
                    onChange={(e) => updateTechnikaField("misto_stage", e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Místo pro FOH</span>
                  <textarea
                    name="misto_foh"
                    value={technika.misto_foh}
                    onChange={(e) => updateTechnikaField("misto_foh", e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>Omezení hluku</span>
                <textarea
                  name="omezeni_hluku"
                  value={technika.omezeni_hluku}
                  onChange={(e) => updateTechnikaField("omezeni_hluku", e.target.value)}
                  disabled={readOnly}
                  rows={2}
                  className={inputClass}
                />
              </label>

              <label className="block space-y-2">
                <span className={labelClass}>Časová omezení</span>
                <textarea
                  name="casova_omezeni"
                  value={technika.casova_omezeni}
                  onChange={(e) => updateTechnikaField("casova_omezeni", e.target.value)}
                  disabled={readOnly}
                  rows={2}
                  className={inputClass}
                />
              </label>

              <label className="block space-y-2">
                <span className={labelClass}>Další technické poznámky</span>
                <textarea
                  name="dalsi_poznamky"
                  value={technika.dalsi_poznamky}
                  onChange={(e) => updateTechnikaField("dalsi_poznamky", e.target.value)}
                  disabled={readOnly}
                  rows={3}
                  className={inputClass}
                />
              </label>

              <label className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-200">
                <input
                  type="checkbox"
                  name="pozadovan_vyjezd_technika"
                  checked={technika.pozadovan_vyjezd_technika}
                  onChange={(e) =>
                    updateTechnikaField("pozadovan_vyjezd_technika", e.target.checked)
                  }
                  disabled={readOnly}
                  value="on"
                />
                <span>Požaduji výjezd technika před akcí</span>
              </label>
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

            {!readOnly && step < maxStep ? (
              <button
                type="button"
                onClick={() => setStep((current) => current + 1)}
                className="rounded-xl border border-amber-500/60 bg-amber-500/20 px-5 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30"
              >
                Pokračovat →
              </button>
            ) : null}

            {!readOnly && step >= 3 && step <= (mode === "create" ? 3 : 4) ? (
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

        {mode === "edit" && poptavkaId && (readOnly || step === 5) ? (
          <div className="mt-8 space-y-6 border-t border-white/10 pt-8">
            <PoptavkaFotkyClient
              key={initialFotky.map((row) => row.id).join("-") || "empty"}
              poptavkaId={poptavkaId}
              initialFotky={initialFotky}
              readOnly={readOnly}
            />
            {!readOnly ? <PoptavkaSubmitButton poptavkaId={poptavkaId} /> : null}
          </div>
        ) : null}
      </PortalCard>
    </PortalShell>
  );
}
