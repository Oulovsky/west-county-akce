import type { PoptavkaFormValues } from "@/lib/client-portal/poptavka-form";
import { validatePoptavkaDraftMinima } from "@/lib/client-portal/poptavka-form";
export { validatePoptavkaDraftMinima };
import type { PoptavkaTechnikaFormValues } from "@/lib/client-portal/poptavka-technika-form";
import {
  REQUIRED_SECTION_PHOTO_KEYS,
  TECHNIKA_SECTION_PHOTOS,
  validateTechnickePodminkyForSave,
  validateTechnickePodminkyForSubmit,
  type SectionPhotoCounts,
} from "@/lib/client-portal/poptavka-technika-podminky";
import { validateSestavaKonfigurator } from "@/lib/client-portal/sestava-konfigurator-form";
import type {
  PortalSestavaKatalog,
  SestavaKonfiguratorState,
} from "@/lib/client-portal/sestava-konfigurator-types";
import { validateLogistikaOkna } from "@/lib/logistika-okna";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const WIZARD_STEP_ERROR_MESSAGES: Record<string, string> = {
  missing_contact: "Vyplňte kontaktní osobu.",
  missing_phone: "Vyplňte telefon.",
  missing_email: "Vyplňte e-mail.",
  invalid_email: "Zadejte platný e-mail.",
  missing_event_name: "Vyplňte název akce.",
  missing_date: "Vyplňte datum akce.",
  missing_location: "Vyplňte místo nebo adresu akce.",
  missing_gps: "Vyberte přesné místo akce v mapě.",
  missing_presny_popis_mista: "Doplňte přesný slovní popis místa akce.",
  missing_date_from: "Vyplňte datum začátku akce.",
  missing_date_to: "Vyplňte datum konce akce.",
  invalid_date_range: "Datum konce musí být stejné nebo pozdější než začátek.",
  missing_saved_misto: "Vyberte uložené místo, nebo přepněte na Nové místo.",
  invalid_logistika_okna:
    "Časové okno stavby nebo bourání není platné. Konec okna musí být po začátku.",
  invalid_sestava:
    "Konfigurace sestavy obsahuje chyby. Doplňte povinné volby ve kroku Konfigurace sestavy.",
  wizard_step_locked: "Nejdřív dokončete předchozí krok.",
  technicke_missing_rezim:
    "Zvolte, zda technické informace vyplníte sami, nebo požádáte o výjezd technika.",
  technicke_missing_potvrzeni:
    "Potvrďte odpovědnost za pravdivost technických informací.",
  technicke_missing_potvrzeni_vyjezd:
    "Potvrďte cenu a podmínky placeného výjezdu technika.",
  technicke_elektro_missing_zdroj:
    "Zvolte typ zdroje elektřiny (pevná přípojka nebo elektrocentrála).",
  technicke_elektro_missing_chranic: "Vyplňte hodnotu hlavního chrániče větve.",
  technicke_elektro_missing_pripojky:
    "Vyplňte počty všech přípojek v rozvaděči (16A, 32A, 64A, 125A) — minimálně 0.",
  technicke_elektro_missing_stage_pripojka:
    "Zvolte, zda je přípojka pro stage techniku samostatná nebo sdílená.",
  technicke_missing_ano_ne:
    "U technických otázek Ano/Ne vyberte vždy Ano nebo Ne. Pokud nevíte, zvolte výjezd technika.",
  technicke_prijezd_missing_volba:
    "U příjezdu zvolte, zda je možný příjezd až k místu stavby stage.",
  technicke_prijezd_missing_vozidlo:
    "Pokud je příjezd až ke stage možný, zaškrtněte alespoň jedno vozidlo (dodávka 3,5 t nebo nákladní 12 t).",
  technicke_prijezd_missing_vzdalenost:
    "Pokud není příjezd až ke stage možný, zadejte vzdálenost možného příjezdu v metrech.",
  technicke_missing_section_photos:
    "Doplňte povinné fotky u všech technických sekcí před odesláním poptávky.",
  technik_vyjezd_missing_gps:
    "Pro objednání výjezdu technika doplňte přesné místo akce v kroku Kde a kdy.",
  technik_vyjezd_missing_fakturace:
    "Potvrďte, že berete na vědomí fakturaci výjezdu technika i při nerealizaci akce.",
  technik_vyjezd_missing_kontakt: "Vyplňte kontaktní osobu a e-mail pro výjezd technika.",
  technik_vyjezd_missing_preference:
    "Vyberte alespoň jeden preferovaný způsob kontaktu (telefon nebo e-mail).",
};

export function wizardErrorMessage(code: string): string {
  return WIZARD_STEP_ERROR_MESSAGES[code] ?? "Zkontrolujte vyplněné údaje.";
}

export function wizardErrorStep(code: string): number {
  if (
    code === "missing_contact" ||
    code === "missing_phone" ||
    code === "missing_email" ||
    code === "invalid_email"
  ) {
    return 1;
  }
  if (
    code === "missing_event_name" ||
    code === "missing_date" ||
    code === "missing_location" ||
    code === "missing_gps" ||
    code === "missing_presny_popis_mista" ||
    code === "missing_date_from" ||
    code === "missing_date_to" ||
    code === "invalid_date_range" ||
    code === "missing_saved_misto" ||
    code === "invalid_logistika_okna" ||
    code === "technik_vyjezd_missing_gps"
  ) {
    return 2;
  }
  if (code === "invalid_sestava") {
    return 3;
  }
  return 4;
}

export function validateWizardStep1(values: PoptavkaFormValues): string | null {
  if (!values.kontakt_jmeno.trim()) return "missing_contact";
  if (!values.kontakt_telefon.trim()) return "missing_phone";
  if (!values.kontakt_email.trim()) return "missing_email";
  if (!EMAIL_RE.test(values.kontakt_email.trim())) return "invalid_email";
  return null;
}

export function validateWizardStep2(values: PoptavkaFormValues): string | null {
  if (!values.misto_nazev.trim()) return "missing_event_name";
  if (!values.misto_adresa.trim()) return "missing_location";
  if (!values.datum_od) return "missing_date_from";
  if (!values.datum_do) return "missing_date_to";
  if (values.datum_do < values.datum_od) return "invalid_date_range";
  if (values.misto_source === "saved" && !values.misto_id) return "missing_saved_misto";
  if (values.misto_lat == null || values.misto_lng == null) return "missing_gps";
  if (!values.presny_popis_mista.trim()) return "missing_presny_popis_mista";
  const oknaError = validateLogistikaOkna(values);
  if (oknaError) return "invalid_logistika_okna";
  return null;
}

export function validateWizardStep3(
  sestava: SestavaKonfiguratorState,
  katalog: PortalSestavaKatalog
): string | null {
  const result = validateSestavaKonfigurator(sestava, katalog);
  if (result.errors.length > 0) return "invalid_sestava";
  return null;
}

export function getWizardStep3Errors(
  sestava: SestavaKonfiguratorState,
  katalog: PortalSestavaKatalog
): string[] {
  return validateSestavaKonfigurator(sestava, katalog).errors;
}

export function validateWizardStep4(
  technika: PoptavkaTechnikaFormValues,
  photoCounts?: SectionPhotoCounts
): string | null {
  return validateTechnickePodminkyForSave({
    wizardStep: 4,
    technickeRezim: technika.technicke_rezim,
    potvrzeniOdpovednosti: technika.technicke_potvrzeni_odpovednosti,
    potvrzeniVyjezdCeny: technika.technicke_potvrzeni_vyjezd_ceny,
    technika,
    requireSectionPhotos: false,
    photoCounts,
  });
}

export function validateWizardStep(
  currentStep: number,
  input: {
    form: PoptavkaFormValues;
    sestava: SestavaKonfiguratorState;
    katalog: PortalSestavaKatalog;
    technika: PoptavkaTechnikaFormValues;
    photoCounts?: SectionPhotoCounts;
  }
): string | null {
  if (currentStep === 1) return validateWizardStep1(input.form);
  if (currentStep === 2) return validateWizardStep2(input.form);
  if (currentStep === 3) return validateWizardStep3(input.sestava, input.katalog);
  if (currentStep === 4) return validateWizardStep4(input.technika, input.photoCounts);
  return null;
}

export function validateWizardStepsUpTo(
  targetStep: number,
  input: {
    form: PoptavkaFormValues;
    sestava: SestavaKonfiguratorState;
    katalog: PortalSestavaKatalog;
    technika: PoptavkaTechnikaFormValues;
    photoCounts?: SectionPhotoCounts;
  }
): string | null {
  for (let step = 1; step < targetStep; step += 1) {
    const error = validateWizardStep(step, input);
    if (error) return error;
  }
  return null;
}

export function computeMaxReachableStep(
  maxStep: number,
  input: {
    form: PoptavkaFormValues;
    sestava: SestavaKonfiguratorState;
    katalog: PortalSestavaKatalog;
  }
): number {
  if (validateWizardStep1(input.form)) return 1;
  if (validateWizardStep2(input.form)) return 2;
  if (maxStep >= 3 && validateWizardStep3(input.sestava, input.katalog)) return 3;
  return maxStep;
}

/** Obnoví krok wizardu po načtení konceptu — respektuje validaci kroků. */
export function resolveWizardResumeStep(
  savedStep: number | null | undefined,
  input: {
    form: PoptavkaFormValues;
    sestava: SestavaKonfiguratorState;
    katalog: PortalSestavaKatalog;
  }
): number {
  const maxReachable = computeMaxReachableStep(4, input);
  const requested = savedStep ?? 1;
  const clamped = Math.min(4, Math.max(1, requested));
  return Math.min(clamped, maxReachable);
}

/** @deprecated Použijte validatePoptavkaDraftMinima pro koncept nebo validateWizardStepsUpTo pro odeslání. */
export function validatePoptavkaFormForSave(values: PoptavkaFormValues): string | null {
  return validateWizardStep1(values) ?? validateWizardStep2(values);
}

export function validateKlientSubmitComplete(input: {
  form: PoptavkaFormValues;
  sestava: SestavaKonfiguratorState;
  katalog: PortalSestavaKatalog;
  technika: PoptavkaTechnikaFormValues;
  photoCounts: SectionPhotoCounts;
}): string | null {
  const stepsError = validateWizardStepsUpTo(4, input);
  if (stepsError) return stepsError;

  if (input.technika.technicke_rezim !== "klient_vyplni") {
    return "technicke_missing_rezim";
  }

  return validateTechnickePodminkyForSubmit({
    technickeRezim: input.technika.technicke_rezim,
    potvrzeniOdpovednosti: input.technika.technicke_potvrzeni_odpovednosti,
    technika: input.technika,
    photoCounts: input.photoCounts,
  });
}

export function validateTechnikVyjezdOrderComplete(input: {
  values: PoptavkaFormValues;
  technika: PoptavkaTechnikaFormValues;
  sestava: SestavaKonfiguratorState;
  katalog: PortalSestavaKatalog;
}): string | null {
  const stepsError = validateWizardStepsUpTo(4, {
    form: input.values,
    sestava: input.sestava,
    katalog: input.katalog,
    technika: input.technika,
  });
  if (stepsError) return stepsError;

  if (input.technika.technicke_rezim !== "vyjezd_technika") {
    return "technicke_missing_rezim";
  }
  if (!input.technika.technicke_potvrzeni_vyjezd_ceny) {
    return "technicke_missing_potvrzeni_vyjezd";
  }
  if (input.values.misto_lat == null || input.values.misto_lng == null) {
    return "technik_vyjezd_missing_gps";
  }
  if (!input.technika.technik_vyjezd_potvrzeni_fakturace) {
    return "technik_vyjezd_missing_fakturace";
  }
  if (
    !input.technika.technik_vyjezd_kontakt_jmeno.trim() ||
    !input.technika.technik_vyjezd_kontakt_email.trim()
  ) {
    return "technik_vyjezd_missing_kontakt";
  }
  if (
    !input.technika.technik_vyjezd_preferuje_telefon &&
    !input.technika.technik_vyjezd_preferuje_email
  ) {
    return "technik_vyjezd_missing_preference";
  }
  return null;
}

export function countSectionPhotos(
  sectionPhotos: Partial<Record<string, { pending: unknown[]; saved: unknown[] }>>
): SectionPhotoCounts {
  const counts: SectionPhotoCounts = {};
  for (const key of REQUIRED_SECTION_PHOTO_KEYS) {
    const state = sectionPhotos[key];
    counts[key] = (state?.pending.length ?? 0) + (state?.saved.length ?? 0);
  }
  return counts;
}

export function getMissingSectionPhotoLabels(counts: SectionPhotoCounts): string[] {
  return TECHNIKA_SECTION_PHOTOS.filter((section) => (counts[section.key] ?? 0) < 1).map(
    (section) => section.label
  );
}
