"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPoptavkaAction,
  orderTechnikVyjezdAndSubmitPoptavkaAction,
  submitKlientPoptavkaAction,
  updatePoptavkaAction,
} from "@/app/portal/poptavky/actions";
import PoptavkaGpsLocationPanel from "@/components/portal/PoptavkaGpsLocationPanel";
import {
  formatCoordsFallbackLabel,
  reverseGeocodePlaceLabel,
} from "@/lib/client-portal/nominatim-place-label";
import { emptyLogistikaOknaValues } from "@/lib/logistika-okna";
import PoptavkaLogistikaOknaPanel from "@/components/portal/PoptavkaLogistikaOknaPanel";
import PoptavkaMistoKnowHowPanel from "@/components/portal/PoptavkaMistoKnowHowPanel";
import PoptavkaSestavaKonfigurator from "@/components/portal/PoptavkaSestavaKonfigurator";
import PoptavkaTechnickePodminkyStep, {
  createInitialSectionPhotos,
} from "@/components/portal/PoptavkaTechnickePodminkyStep";
import { appendPendingSectionPhotos } from "@/components/portal/PoptavkaTechnikaSectionPhoto";
import type { SectionPhotoState } from "@/components/portal/PoptavkaTechnikaSectionPhoto";
import type { TechnickeRezim, TechnikaSectionPhotoKey } from "@/lib/client-portal/poptavka-technika-podminky";
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
  EMPTY_POPTAVKA_TECHNIKA,
  type PoptavkaTechnikaFormValues,
} from "@/lib/client-portal/poptavka-technika-form";
import {
  EMPTY_SESTAVA_KONFIGURATOR,
  deriveSetupSelectionsFromSestava,
  migrateLegacySestavaState,
  normalizeSestavaStateForSave,
} from "@/lib/client-portal/sestava-konfigurator-form";
import type {
  PortalSestavaKatalog,
  SestavaKonfiguratorState,
} from "@/lib/client-portal/sestava-konfigurator-types";
import {
  WIZARD_STEP_ERROR_MESSAGES,
  computeMaxReachableStep,
  getWizardStep3Errors,
  validatePoptavkaDraftMinima,
  validateTechnikVyjezdOrderComplete,
  validateKlientSubmitComplete,
  countSectionPhotos,
  getMissingSectionPhotoLabels,
  resolveWizardResumeStep,
  validateWizardStep,
  validateWizardStep3,
  validateWizardStepsUpTo,
  wizardErrorMessage,
  wizardErrorStep,
} from "@/lib/client-portal/poptavka-wizard-validation";

const ERROR_MESSAGES: Record<string, string> = {
  ...WIZARD_STEP_ERROR_MESSAGES,
  save_failed: "Poptávku se nepodařilo uložit.",
  setups_failed: "Základ poptávky byl uložen, ale setupy se nepodařilo zapsat.",
  not_editable: "Tuto poptávku už nelze upravovat.",
  not_found: "Poptávka nenalezena.",
  submit_incomplete: "Doplňte kontakt, název akce a termín před odesláním.",
  submit_failed: "Odeslání se nezdařilo.",
  invalid_misto:
    "Vybrané místo není dostupné pro váš účet. Vyberte jiné místo nebo zadejte nové.",
  invalid_setups:
    "Vybrané setupy už nejsou v portálu dostupné. Upravte výběr techniky a uložte znovu.",
};

type Props = {
  mode: "create" | "edit";
  prefill: PoptavkaPrefill;
  setupsByOblast: PortalSetupsByOblast;
  savedMista?: ClientPortalMistoSummary[];
  savedMistaKnowHowById?: Record<string, ClientPortalMistoKnowHow>;
  sestavaKatalog: PortalSestavaKatalog;
  initialSestava?: SestavaKonfiguratorState;
  initialValues?: Partial<PoptavkaFormValues> & { wizard_krok?: number | null };
  initialTechnika?: PoptavkaTechnikaFormValues;
  initialFotky?: PoptavkaFotkaWithUrl[];
  poptavkaId?: string;
  readOnly?: boolean;
  errorCode?: string | null;
  saved?: boolean;
  submitted?: boolean;
  technikVyjezdOrdered?: boolean;
  revisionNote?: string | null;
};

type PendingIntent = "draft" | "submit_klient" | "order_technik_vyjezd";

const WIZARD_STEPS = [
  { id: 1, title: "Kdo zadává" },
  { id: 2, title: "Kde a kdy" },
  { id: 3, title: "Konfigurace sestavy" },
  { id: 4, title: "Technické podmínky" },
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
  technikVyjezdOrdered,
  revisionNote,
}: Props) {
  const steps = WIZARD_STEPS;
  const maxStep = steps.length;
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(1);
  const [mistoAdresaAuto, setMistoAdresaAuto] = useState(() => !initialValues?.misto_adresa?.trim());
  const [stepError, setStepError] = useState<string | null>(null);
  const [stepErrorDetails, setStepErrorDetails] = useState<string[]>([]);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null);
  const [technickeUiRezim, setTechnickeUiRezim] = useState<TechnickeRezim | null>(() => {
    const rezim = initialTechnika?.technicke_rezim;
    return rezim === "klient_vyplni" || rezim === "vyjezd_technika" ? rezim : null;
  });
  const [technickeUiPotvrzeno, setTechnickeUiPotvrzeno] = useState(() =>
    Boolean(
      initialTechnika?.technicke_potvrzeni_odpovednosti ||
        initialTechnika?.technicke_potvrzeni_vyjezd_ceny
    )
  );
  const [sectionPhotos, setSectionPhotos] = useState<
    Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>>
  >(() => createInitialSectionPhotos(initialFotky));

  const showSaveActions = !readOnly;

  const [form, setForm] = useState<PoptavkaFormValues>({
    kontakt_jmeno: initialValues?.kontakt_jmeno ?? prefill.kontakt_jmeno,
    kontakt_telefon: initialValues?.kontakt_telefon ?? prefill.kontakt_telefon,
    kontakt_email: initialValues?.kontakt_email ?? prefill.kontakt_email,
    misto_nazev: initialValues?.misto_nazev ?? "",
    typ_akce: initialValues?.typ_akce ?? "",
    misto_adresa: initialValues?.misto_adresa ?? "",
    presny_popis_mista: initialValues?.presny_popis_mista ?? "",
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

  const [sestava, setSestava] = useState<SestavaKonfiguratorState>(() =>
    migrateLegacySestavaState({
      ...EMPTY_SESTAVA_KONFIGURATOR,
      ...initialSestava,
    })
  );

  const sestavaJson = useMemo(
    () => JSON.stringify(normalizeSestavaStateForSave(sestava)),
    [sestava]
  );

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

  const maxReachableStep = useMemo(
    () =>
      computeMaxReachableStep(maxStep, {
        form,
        sestava,
        katalog: sestavaKatalog,
      }),
    [maxStep, form, sestava, sestavaKatalog]
  );

  const wizardInput = useMemo(
    () => ({
      form,
      sestava,
      katalog: sestavaKatalog,
      technika,
      photoCounts: countSectionPhotos(sectionPhotos),
    }),
    [form, sestava, sestavaKatalog, technika, sectionPhotos]
  );

  const resumedRef = useRef(false);
  useEffect(() => {
    if (readOnly || resumedRef.current || mode !== "edit") return;
    resumedRef.current = true;
    setStep(
      resolveWizardResumeStep(initialValues?.wizard_krok, {
        form,
        sestava,
        katalog: sestavaKatalog,
      })
    );
  }, [readOnly, mode, initialValues?.wizard_krok, form, sestava, sestavaKatalog]);

  useEffect(() => {
    if (saved || submitted || technikVyjezdOrdered || errorCode) {
      setPendingIntent(null);
    }
  }, [saved, submitted, technikVyjezdOrdered, errorCode]);

  const effectiveTechnickeRezim =
    technickeUiRezim ??
    (technika.technicke_rezim === "klient_vyplni" || technika.technicke_rezim === "vyjezd_technika"
      ? technika.technicke_rezim
      : null);
  const effectiveTechnickePotvrzeno =
    technickeUiPotvrzeno ||
    technika.technicke_potvrzeni_odpovednosti ||
    technika.technicke_potvrzeni_vyjezd_ceny;
  const canOrderTechnikVyjezd =
    form.misto_lat != null &&
    form.misto_lng != null &&
    technika.technik_vyjezd_potvrzeni_fakturace &&
    Boolean(technika.technik_vyjezd_kontakt_jmeno.trim()) &&
    Boolean(technika.technik_vyjezd_kontakt_email.trim()) &&
    (technika.technik_vyjezd_preferuje_telefon || technika.technik_vyjezd_preferuje_email);

  function submitWithIntent(intent: PendingIntent) {
    const formEl = document.getElementById("poptavka-wizard-form") as HTMLFormElement | null;
    if (!formEl || readOnly) return;
    const intentInput = formEl.querySelector<HTMLInputElement>('input[name="save_intent"]');
    if (intentInput) intentInput.value = intent;
    formEl.requestSubmit();
  }

  function normalizeSubmitIntent(raw: string): PendingIntent {
    if (raw === "submit_klient") return "submit_klient";
    if (raw === "order_technik_vyjezd") return "order_technik_vyjezd";
    return "draft";
  }

  async function applyMapCoords(lat: number | null, lng: number | null) {
    setForm((current) => ({ ...current, misto_lat: lat, misto_lng: lng }));
    if (lat == null || lng == null) return;

    const label = (await reverseGeocodePlaceLabel(lat, lng)) ?? formatCoordsFallbackLabel(lat, lng);
    setForm((current) => {
      if (!mistoAdresaAuto && current.misto_adresa.trim()) {
        return { ...current, misto_lat: lat, misto_lng: lng };
      }
      return { ...current, misto_lat: lat, misto_lng: lng, misto_adresa: label };
    });
    if (mistoAdresaAuto || !form.misto_adresa.trim()) {
      setMistoAdresaAuto(true);
    }
  }

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

  function goToStep(next: number | ((current: number) => number)) {
    setStep(next);
    if (errorCode) {
      router.replace(pathname, { scroll: false });
    }
  }

  function showStepValidationError(code: string, details: string[] = []) {
    setStepError(code);
    setStepErrorDetails(details);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function clearStepValidationError() {
    setStepError(null);
    setStepErrorDetails([]);
  }

  function attemptGoToStep(targetStep: number) {
    if (readOnly || targetStep === step) return;

    if (targetStep < step) {
      clearStepValidationError();
      goToStep(targetStep);
      return;
    }

    if (targetStep > maxReachableStep) {
      showStepValidationError("wizard_step_locked");
      return;
    }

    const blockError = validateWizardStepsUpTo(targetStep, wizardInput);
    if (blockError) {
      showStepValidationError(
        blockError,
        blockError === "invalid_sestava" ? getWizardStep3Errors(sestava, sestavaKatalog) : []
      );
      setStep(wizardErrorStep(blockError));
      return;
    }

    clearStepValidationError();
    goToStep(targetStep);
  }

  function attemptContinue() {
    const error = validateWizardStep(step, wizardInput);
    if (error) {
      showStepValidationError(
        error,
        error === "invalid_sestava" ? getWizardStep3Errors(sestava, sestavaKatalog) : []
      );
      return;
    }

    clearStepValidationError();
    goToStep(step + 1);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;

    const formData = new FormData(event.currentTarget);
    formData.set("wizard_step", String(step));
    const intent = normalizeSubmitIntent(String(formData.get("save_intent") ?? "draft"));

    if (intent === "order_technik_vyjezd") {
      const orderError = validateTechnikVyjezdOrderComplete({
        values: form,
        technika,
        sestava,
        katalog: sestavaKatalog,
      });
      if (orderError) {
        showStepValidationError(
          orderError,
          orderError === "invalid_sestava" ? getWizardStep3Errors(sestava, sestavaKatalog) : []
        );
        setStep(wizardErrorStep(orderError));
        return;
      }
    } else if (intent === "submit_klient") {
      const submitError = validateKlientSubmitComplete({
        form,
        sestava,
        katalog: sestavaKatalog,
        technika,
        photoCounts: countSectionPhotos(sectionPhotos),
      });
      if (submitError) {
        const details =
          submitError === "invalid_sestava"
            ? getWizardStep3Errors(sestava, sestavaKatalog)
            : submitError === "technicke_missing_section_photos"
              ? getMissingSectionPhotoLabels(countSectionPhotos(sectionPhotos))
              : [];
        showStepValidationError(submitError, details);
        setStep(wizardErrorStep(submitError));
        return;
      }
    } else {
      const saveError = validatePoptavkaDraftMinima(form);
      if (saveError) {
        showStepValidationError(saveError);
        setStep(wizardErrorStep(saveError));
        return;
      }
    }

    setPendingIntent(intent);

    const pendingBySection: Partial<
      Record<TechnikaSectionPhotoKey, { id: string; file: File; previewUrl: string }[]>
    > = {};
    for (const [key, state] of Object.entries(sectionPhotos)) {
      if (state?.pending.length) {
        pendingBySection[key as TechnikaSectionPhotoKey] = state.pending;
      }
    }
    appendPendingSectionPhotos(formData, pendingBySection);

    if (intent === "order_technik_vyjezd") {
      void orderTechnikVyjezdAndSubmitPoptavkaAction(formData);
      return;
    }

    if (intent === "submit_klient") {
      void submitKlientPoptavkaAction(formData);
      return;
    }

    void formAction(formData);
  }

  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.tagName === "TEXTAREA") return;
    if (target instanceof HTMLButtonElement && target.type === "submit") return;
    if (target.tagName === "INPUT" || target.tagName === "SELECT") {
      event.preventDefault();
      if (target instanceof HTMLInputElement) {
        target.blur();
      }
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
        {technikVyjezdOrdered ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Poptávka byla odeslána a závazná objednávka výjezdu technika byla přijata. Spojíme
            se s vámi ohledně termínu výjezdu podle uvedených kontaktních údajů.
          </p>
        ) : null}
        {saved ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Poptávka byla uložena jako koncept.
          </p>
        ) : null}
        {errorCode && !stepError && ERROR_MESSAGES[errorCode] ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {ERROR_MESSAGES[errorCode]}
          </p>
        ) : null}
        {stepError ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <p>{wizardErrorMessage(stepError)}</p>
            {stepErrorDetails.length > 0 ? (
              <ul className="mt-2 list-inside list-disc space-y-1 text-red-100/90">
                {stepErrorDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {!readOnly ? (
          <div className="mb-8 flex flex-wrap gap-2">
            {steps.map((item) => {
              const isActive = step === item.id;
              const isLocked = item.id > maxReachableStep;
              const isCompleted = item.id < step && item.id <= maxReachableStep;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isLocked}
                  title={isLocked ? "Nejdřív dokončete předchozí krok." : undefined}
                  onClick={() => attemptGoToStep(item.id)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-amber-500/25 text-amber-50 ring-1 ring-amber-500/50"
                      : isLocked
                        ? "cursor-not-allowed bg-white/[0.02] text-slate-600 opacity-60"
                        : isCompleted
                          ? "bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                          : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                  }`}
                >
                  {item.id}. {item.title}
                </button>
              );
            })}
          </div>
        ) : null}

        <form
          id="poptavka-wizard-form"
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

          <input type="hidden" name="save_intent" value="draft" readOnly />

          <input type="hidden" name="wizard_step" value={step} readOnly />

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
              <input
                type="hidden"
                name="presny_popis_mista"
                value={form.presny_popis_mista}
                readOnly
              />
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

          {!readOnly && step !== 4 ? (
            <>
              <input type="hidden" name="technicke_rezim" value={technika.technicke_rezim} readOnly />
              {technika.technicke_potvrzeni_odpovednosti ? (
                <input type="hidden" name="technicke_potvrzeni_odpovednosti" value="on" readOnly />
              ) : null}
              {technika.technicke_potvrzeni_vyjezd_ceny ? (
                <input type="hidden" name="technicke_potvrzeni_vyjezd_ceny" value="on" readOnly />
              ) : null}
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
              <input type="hidden" name="elektro_zdroj_typ" value={technika.elektro_zdroj_typ} readOnly />
              <input
                type="hidden"
                name="hlavni_chranic_vetve"
                value={technika.hlavni_chranic_vetve}
                readOnly
              />
              <input type="hidden" name="pripojky_16a_count" value={technika.pripojky_16a_count} readOnly />
              <input type="hidden" name="pripojky_32a_count" value={technika.pripojky_32a_count} readOnly />
              <input type="hidden" name="pripojky_64a_count" value={technika.pripojky_64a_count} readOnly />
              <input type="hidden" name="pripojky_125a_count" value={technika.pripojky_125a_count} readOnly />
              <input
                type="hidden"
                name="stage_pripojka_rezim"
                value={technika.stage_pripojka_rezim}
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
              <input type="hidden" name="prijezd_az_ke_stage" value={technika.prijezd_az_ke_stage} readOnly />
              {technika.prijezd_dodavka_35t ? (
                <input type="hidden" name="prijezd_dodavka_35t" value="on" readOnly />
              ) : null}
              {technika.prijezd_nakladni_12t ? (
                <input type="hidden" name="prijezd_nakladni_12t" value="on" readOnly />
              ) : null}
              <input
                type="hidden"
                name="prijezd_vzdalenost_od_stage_m"
                value={technika.prijezd_vzdalenost_od_stage_m}
                readOnly
              />
              <input type="hidden" name="misto_zpevnene" value={technika.misto_zpevnene} readOnly />
              <input
                type="hidden"
                name="kabel_pres_silnici"
                value={technika.kabel_pres_silnici}
                readOnly
              />
              <input
                type="hidden"
                name="vzdalenost_vykladka_stage"
                value={technika.vzdalenost_vykladka_stage}
                readOnly
              />
              <input
                type="hidden"
                name="pristup_pro_techniku"
                value={technika.pristup_pro_techniku}
                readOnly
              />
              <input
                type="hidden"
                name="omezeni_prujezdu"
                value={technika.omezeni_prujezdu}
                readOnly
              />
              {technika.pozadovan_vyjezd_technika ? (
                <input type="hidden" name="pozadovan_vyjezd_technika" value="on" readOnly />
              ) : null}
              <input
                type="hidden"
                name="technik_vyjezd_kontakt_jmeno"
                value={technika.technik_vyjezd_kontakt_jmeno}
                readOnly
              />
              <input
                type="hidden"
                name="technik_vyjezd_kontakt_telefon"
                value={technika.technik_vyjezd_kontakt_telefon}
                readOnly
              />
              <input
                type="hidden"
                name="technik_vyjezd_kontakt_email"
                value={technika.technik_vyjezd_kontakt_email}
                readOnly
              />
              {technika.technik_vyjezd_preferuje_telefon ? (
                <input type="hidden" name="technik_vyjezd_preferuje_telefon" value="on" readOnly />
              ) : null}
              {technika.technik_vyjezd_preferuje_email ? (
                <input type="hidden" name="technik_vyjezd_preferuje_email" value="on" readOnly />
              ) : null}
              {technika.technik_vyjezd_potvrzeni_fakturace ? (
                <input
                  type="hidden"
                  name="technik_vyjezd_potvrzeni_fakturace"
                  value="on"
                  readOnly
                />
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
                  <span className={labelClass}>Telefon *</span>
                  <input
                    name="kontakt_telefon"
                    value={form.kontakt_telefon}
                    onChange={(e) => updateField("kontakt_telefon", e.target.value)}
                    disabled={readOnly}
                    required
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
                  onChange={(e) => {
                    setMistoAdresaAuto(false);
                    updateField("misto_adresa", e.target.value);
                  }}
                  disabled={readOnly}
                  required
                  className={inputClass}
                />
              </label>

              <label className="block space-y-2">
                <span className={labelClass}>
                  Přesný popis místa akce <span className="text-amber-300">*</span>
                </span>
                <textarea
                  name="presny_popis_mista"
                  value={form.presny_popis_mista}
                  onChange={(e) => updateField("presny_popis_mista", e.target.value)}
                  disabled={readOnly}
                  required
                  rows={3}
                  className={inputClass}
                  placeholder="Např. travnatá plocha vedle fotbalového hřiště, vjezd z ulice …"
                />
                <p className="text-xs text-slate-500">
                  GPS bod nestačí — popište slovně, kde přesně má stát stage a technika.
                </p>
              </label>

              {!readOnly || form.misto_lat != null ? (
                <PoptavkaGpsLocationPanel
                  placeQuery={[form.misto_adresa, form.misto_nazev].filter(Boolean).join(", ")}
                  lat={form.misto_lat}
                  lng={form.misto_lng}
                  readOnly={readOnly}
                  onCoordsChange={applyMapCoords}
                />
              ) : null}

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
                onChange={(next) => setSestava(normalizeSestavaStateForSave(next))}
                readOnly={readOnly}
                inputClass={inputClass}
                labelClass={labelClass}
                optionCardClass={optionCardClass}
              />
            </section>
          )}

          {(readOnly || step === 4) && (
            <PoptavkaTechnickePodminkyStep
              technika={technika}
              onChange={setTechnika}
              uiRezim={technickeUiRezim}
              uiPotvrzeno={technickeUiPotvrzeno}
              onUiRezimChange={setTechnickeUiRezim}
              onUiPotvrzenoChange={setTechnickeUiPotvrzeno}
              readOnly={readOnly}
              poptavkaId={poptavkaId}
              initialFotky={initialFotky}
              sectionPhotos={sectionPhotos}
              onSectionPhotosChange={(key, next) =>
                setSectionPhotos((current) => ({ ...current, [key]: next }))
              }
              inputClass={inputClass}
              labelClass={labelClass}
              optionCardClass={optionCardClass}
              mistoLat={form.misto_lat}
              mistoLng={form.misto_lng}
              kontaktJmeno={form.kontakt_jmeno}
              kontaktTelefon={form.kontakt_telefon}
              kontaktEmail={form.kontakt_email}
              highlightMissingPhotos={stepError === "technicke_missing_section_photos"}
            />
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
            {!readOnly && step > 1 ? (
              <button
                type="button"
                onClick={() => goToStep((current) => current - 1)}
                disabled={pendingIntent !== null}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                ← Zpět
              </button>
            ) : null}

            {!readOnly && step < maxStep ? (
              <button
                type="button"
                onClick={attemptContinue}
                disabled={pendingIntent !== null}
                className="rounded-xl border border-amber-500/60 bg-amber-500/20 px-5 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Pokračovat →
              </button>
            ) : null}

            {showSaveActions ? (
              <button
                type="button"
                disabled={pendingIntent !== null}
                onClick={() => submitWithIntent("draft")}
                className="rounded-xl border border-amber-500/60 bg-amber-500/20 px-5 py-3 text-sm font-bold text-amber-50 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingIntent === "draft"
                  ? "Ukládám…"
                  : mode === "create"
                    ? "Uložit koncept"
                    : "Uložit změny"}
              </button>
            ) : null}

            {!readOnly &&
            step === 4 &&
            effectiveTechnickeRezim === "klient_vyplni" &&
            effectiveTechnickePotvrzeno ? (
              <button
                type="button"
                disabled={pendingIntent !== null}
                onClick={() => submitWithIntent("submit_klient")}
                className="rounded-xl border border-blue-500/60 bg-blue-500/20 px-5 py-3 text-sm font-bold text-blue-50 transition hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingIntent === "submit_klient" ? "Odesílám…" : "Odeslat poptávku"}
              </button>
            ) : null}

            {!readOnly &&
            step === 4 &&
            effectiveTechnickeRezim === "vyjezd_technika" &&
            effectiveTechnickePotvrzeno ? (
              <button
                type="button"
                disabled={pendingIntent !== null || !canOrderTechnikVyjezd}
                onClick={() => submitWithIntent("order_technik_vyjezd")}
                className="rounded-xl border border-emerald-500/60 bg-emerald-500/20 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingIntent === "order_technik_vyjezd"
                  ? "Odesílám…"
                  : "Odeslat poptávku a závazně objednat výjezd technika"}
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
