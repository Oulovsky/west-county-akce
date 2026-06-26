import type { PoptavkaTechnickeUdaje } from "@/lib/client-portal/types";
import type { TechnickeRezim } from "@/lib/client-portal/poptavka-technika-podminky";

export type ElektroZdrojTyp = "pevna_pripojka" | "elektrocentrala";
export type StagePripojkaRezim = "samostatna_pro_stage" | "sdilena_s_dalsimi_odbery";

export type PoptavkaTechnikaFormValues = {
  technicke_rezim: TechnickeRezim | "";
  technicke_potvrzeni_odpovednosti: boolean;
  technicke_potvrzeni_vyjezd_ceny: boolean;
  elektro_zdroj_typ: ElektroZdrojTyp | "";
  hlavni_chranic_vetve: string;
  pripojky_16a_count: string;
  pripojky_32a_count: string;
  pripojky_64a_count: string;
  pripojky_125a_count: string;
  stage_pripojka_rezim: StagePripojkaRezim | "";
  prijezd_poznamka: string;
  parkovani_poznamka: string;
  rozvadece_poznamka: string;
  elektro_pripojka: string;
  elektro_jisteni: string;
  elektro_zasuvka: string;
  elektro_vzdalenost_m: string;
  kabelove_trasy: string;
  misto_stage: string;
  misto_foh: string;
  omezeni_hluku: string;
  casova_omezeni: string;
  dalsi_poznamky: string;
  pozadovan_vyjezd_technika: boolean;
  lze_zajet_autem: string;
  misto_zpevnene: string;
  kabel_pres_silnici: string;
  vzdalenost_vykladka_stage: string;
  pristup_pro_techniku: string;
  omezeni_prujezdu: string;
};

export const EMPTY_POPTAVKA_TECHNIKA: PoptavkaTechnikaFormValues = {
  technicke_rezim: "",
  technicke_potvrzeni_odpovednosti: false,
  technicke_potvrzeni_vyjezd_ceny: false,
  elektro_zdroj_typ: "",
  hlavni_chranic_vetve: "",
  pripojky_16a_count: "",
  pripojky_32a_count: "",
  pripojky_64a_count: "",
  pripojky_125a_count: "",
  stage_pripojka_rezim: "",
  prijezd_poznamka: "",
  parkovani_poznamka: "",
  rozvadece_poznamka: "",
  elektro_pripojka: "",
  elektro_jisteni: "",
  elektro_zasuvka: "",
  elektro_vzdalenost_m: "",
  kabelove_trasy: "",
  misto_stage: "",
  misto_foh: "",
  omezeni_hluku: "",
  casova_omezeni: "",
  dalsi_poznamky: "",
  pozadovan_vyjezd_technika: false,
  lze_zajet_autem: "",
  misto_zpevnene: "",
  kabel_pres_silnici: "",
  vzdalenost_vykladka_stage: "",
  pristup_pro_techniku: "",
  omezeni_prujezdu: "",
};

export const ELEKTRO_ZDROJ_OPTIONS: { value: ElektroZdrojTyp; label: string }[] = [
  { value: "pevna_pripojka", label: "Pevná přípojka k síti" },
  { value: "elektrocentrala", label: "Elektrocentrála" },
];

export const STAGE_PRIPOJKA_OPTIONS: { value: StagePripojkaRezim; label: string }[] = [
  {
    value: "samostatna_pro_stage",
    label: "Samostatná přípojka pro stage techniku",
  },
  {
    value: "sdilena_s_dalsimi_odbery",
    label: "Sdílená přípojka — například stánky, catering apod.",
  },
];

export const SDILENA_PRIPOJKA_VAROVANI =
  "Stánky, catering ani jiné odběry nesmí být na stejném jističi / chrániči jako stage technika. Sdílená přípojka může způsobit výpadky a nemusí být pro realizaci akce akceptovatelná.";

export const ANO_NE_OPTIONS = [
  ["ano", "Ano"],
  ["ne", "Ne"],
] as const;

export const PRIPOJKA_COUNT_FIELDS = [
  { key: "pripojky_16a_count" as const, label: "16A" },
  { key: "pripojky_32a_count" as const, label: "32A" },
  { key: "pripojky_64a_count" as const, label: "64A" },
  { key: "pripojky_125a_count" as const, label: "125A" },
] as const;

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function toOptionalNumber(value: string) {
  const text = value.trim().replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function toRequiredCount(value: string) {
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number < 0) return null;
  return number;
}

function parseAnoNe(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (text === "ano" || text === "ne") return text;
  return "";
}

function parseElektroZdroj(value: FormDataEntryValue | null): ElektroZdrojTyp | "" {
  const text = String(value ?? "").trim();
  if (text === "pevna_pripojka" || text === "elektrocentrala") return text;
  return "";
}

function parseStagePripojka(value: FormDataEntryValue | null): StagePripojkaRezim | "" {
  const text = String(value ?? "").trim();
  if (text === "samostatna_pro_stage" || text === "sdilena_s_dalsimi_odbery") return text;
  return "";
}

function parseTechnickeRezim(value: FormDataEntryValue | null): TechnickeRezim | "" {
  const text = String(value ?? "").trim();
  if (text === "klient_vyplni" || text === "vyjezd_technika") return text;
  return "";
}

function normalizeLegacyAnoNe(value: unknown) {
  const text = String(value ?? "").trim();
  if (text === "ano" || text === "ne") return text;
  return "";
}

export function technikaFromRecord(
  row: PoptavkaTechnickeUdaje | null | undefined
): PoptavkaTechnikaFormValues {
  if (!row) return { ...EMPTY_POPTAVKA_TECHNIKA };

  const extra = row.odpovedi_extra ?? {};
  const rezim =
    row.technicke_rezim === "klient_vyplni" || row.technicke_rezim === "vyjezd_technika"
      ? row.technicke_rezim
      : row.pozadovan_vyjezd_technika
        ? "vyjezd_technika"
        : "";

  const zdroj =
    row.elektro_zdroj_typ === "pevna_pripojka" || row.elektro_zdroj_typ === "elektrocentrala"
      ? row.elektro_zdroj_typ
      : "";

  const stagePripojka =
    row.stage_pripojka_rezim === "samostatna_pro_stage" ||
    row.stage_pripojka_rezim === "sdilena_s_dalsimi_odbery"
      ? row.stage_pripojka_rezim
      : "";

  return {
    technicke_rezim: rezim,
    technicke_potvrzeni_odpovednosti: Boolean(row.technicke_potvrzeni_odpovednosti_at),
    technicke_potvrzeni_vyjezd_ceny: Boolean(row.technicke_potvrzeni_vyjezd_ceny_at),
    elektro_zdroj_typ: zdroj,
    hlavni_chranic_vetve: row.hlavni_chranic_vetve ?? row.elektro_jisteni ?? "",
    pripojky_16a_count:
      row.pripojky_16a_count != null ? String(row.pripojky_16a_count) : "",
    pripojky_32a_count:
      row.pripojky_32a_count != null ? String(row.pripojky_32a_count) : "",
    pripojky_64a_count:
      row.pripojky_64a_count != null ? String(row.pripojky_64a_count) : "",
    pripojky_125a_count:
      row.pripojky_125a_count != null ? String(row.pripojky_125a_count) : "",
    stage_pripojka_rezim: stagePripojka,
    prijezd_poznamka: row.prijezd_poznamka ?? "",
    parkovani_poznamka: row.parkovani_poznamka ?? "",
    rozvadece_poznamka: row.rozvadece_poznamka ?? "",
    elektro_pripojka: row.elektro_pripojka ?? "",
    elektro_jisteni: row.elektro_jisteni ?? "",
    elektro_zasuvka: row.elektro_zasuvka ?? "",
    elektro_vzdalenost_m:
      row.elektro_vzdalenost_m != null ? String(row.elektro_vzdalenost_m) : "",
    kabelove_trasy: row.kabelove_trasy ?? "",
    misto_stage: row.misto_stage ?? "",
    misto_foh: row.misto_foh ?? "",
    omezeni_hluku: row.omezeni_hluku ?? "",
    casova_omezeni: row.casova_omezeni ?? "",
    dalsi_poznamky: row.dalsi_poznamky ?? "",
    pozadovan_vyjezd_technika: row.pozadovan_vyjezd_technika,
    lze_zajet_autem: normalizeLegacyAnoNe(extra.lze_zajet_autem),
    misto_zpevnene: normalizeLegacyAnoNe(extra.misto_zpevnene),
    kabel_pres_silnici: normalizeLegacyAnoNe(extra.kabel_pres_silnici),
    vzdalenost_vykladka_stage: String(extra.vzdalenost_vykladka_stage ?? ""),
    pristup_pro_techniku: String(extra.pristup_pro_techniku ?? ""),
    omezeni_prujezdu: String(extra.omezeni_prujezdu ?? ""),
  };
}

export function parseTechnikaFormData(formData: FormData): PoptavkaTechnikaFormValues {
  const rezim = parseTechnickeRezim(formData.get("technicke_rezim"));

  return {
    technicke_rezim: rezim,
    technicke_potvrzeni_odpovednosti: formData.get("technicke_potvrzeni_odpovednosti") === "on",
    technicke_potvrzeni_vyjezd_ceny: formData.get("technicke_potvrzeni_vyjezd_ceny") === "on",
    elektro_zdroj_typ: parseElektroZdroj(formData.get("elektro_zdroj_typ")),
    hlavni_chranic_vetve: String(formData.get("hlavni_chranic_vetve") ?? "").trim(),
    pripojky_16a_count: String(formData.get("pripojky_16a_count") ?? "").trim(),
    pripojky_32a_count: String(formData.get("pripojky_32a_count") ?? "").trim(),
    pripojky_64a_count: String(formData.get("pripojky_64a_count") ?? "").trim(),
    pripojky_125a_count: String(formData.get("pripojky_125a_count") ?? "").trim(),
    stage_pripojka_rezim: parseStagePripojka(formData.get("stage_pripojka_rezim")),
    prijezd_poznamka: String(formData.get("prijezd_poznamka") ?? "").trim(),
    parkovani_poznamka: String(formData.get("parkovani_poznamka") ?? "").trim(),
    rozvadece_poznamka: String(formData.get("rozvadece_poznamka") ?? "").trim(),
    elektro_pripojka: String(formData.get("elektro_pripojka") ?? "").trim(),
    elektro_jisteni: String(formData.get("elektro_jisteni") ?? "").trim(),
    elektro_zasuvka: String(formData.get("elektro_zasuvka") ?? "").trim(),
    elektro_vzdalenost_m: String(formData.get("elektro_vzdalenost_m") ?? "").trim(),
    kabelove_trasy: String(formData.get("kabelove_trasy") ?? "").trim(),
    misto_stage: String(formData.get("misto_stage") ?? "").trim(),
    misto_foh: String(formData.get("misto_foh") ?? "").trim(),
    omezeni_hluku: String(formData.get("omezeni_hluku") ?? "").trim(),
    casova_omezeni: String(formData.get("casova_omezeni") ?? "").trim(),
    dalsi_poznamky: String(formData.get("dalsi_poznamky") ?? "").trim(),
    pozadovan_vyjezd_technika:
      rezim === "vyjezd_technika" || formData.get("pozadovan_vyjezd_technika") === "on",
    lze_zajet_autem: parseAnoNe(formData.get("lze_zajet_autem")),
    misto_zpevnene: parseAnoNe(formData.get("misto_zpevnene")),
    kabel_pres_silnici: parseAnoNe(formData.get("kabel_pres_silnici")),
    vzdalenost_vykladka_stage: String(formData.get("vzdalenost_vykladka_stage") ?? "").trim(),
    pristup_pro_techniku: String(formData.get("pristup_pro_techniku") ?? "").trim(),
    omezeni_prujezdu: String(formData.get("omezeni_prujezdu") ?? "").trim(),
  };
}

export function buildTechnikaRowPayload(
  values: PoptavkaTechnikaFormValues,
  extraFields?: Record<string, unknown>
) {
  const now = new Date().toISOString();
  const rezim = values.technicke_rezim || null;

  return {
    prijezd_poznamka: nullable(values.prijezd_poznamka),
    parkovani_poznamka: nullable(values.parkovani_poznamka),
    rozvadece_poznamka: nullable(values.rozvadece_poznamka),
    elektro_pripojka: nullable(values.elektro_pripojka),
    elektro_jisteni: nullable(values.hlavni_chranic_vetve || values.elektro_jisteni),
    elektro_zasuvka: nullable(values.elektro_zasuvka),
    elektro_vzdalenost_m: toOptionalNumber(values.elektro_vzdalenost_m),
    elektro_zdroj_typ: values.elektro_zdroj_typ || null,
    hlavni_chranic_vetve: nullable(values.hlavni_chranic_vetve),
    pripojky_16a_count: toRequiredCount(values.pripojky_16a_count),
    pripojky_32a_count: toRequiredCount(values.pripojky_32a_count),
    pripojky_64a_count: toRequiredCount(values.pripojky_64a_count),
    pripojky_125a_count: toRequiredCount(values.pripojky_125a_count),
    stage_pripojka_rezim: values.stage_pripojka_rezim || null,
    kabelove_trasy: nullable(values.kabelove_trasy),
    misto_stage: nullable(values.misto_stage),
    misto_foh: nullable(values.misto_foh),
    omezeni_hluku: nullable(values.omezeni_hluku),
    casova_omezeni: nullable(values.casova_omezeni),
    dalsi_poznamky: nullable(values.dalsi_poznamky),
    pozadovan_vyjezd_technika: rezim === "vyjezd_technika",
    technicke_rezim: rezim,
    technicke_potvrzeni_odpovednosti_at:
      rezim === "klient_vyplni" && values.technicke_potvrzeni_odpovednosti ? now : null,
    technicke_potvrzeni_vyjezd_ceny_at:
      rezim === "vyjezd_technika" && values.technicke_potvrzeni_vyjezd_ceny ? now : null,
    rizika: [],
    odpovedi_extra: {
      lze_zajet_autem: values.lze_zajet_autem || null,
      misto_zpevnene: values.misto_zpevnene || null,
      kabel_pres_silnici: values.kabel_pres_silnici || null,
      vzdalenost_vykladka_stage: nullable(values.vzdalenost_vykladka_stage),
      pristup_pro_techniku: nullable(values.pristup_pro_techniku),
      omezeni_prujezdu: nullable(values.omezeni_prujezdu),
      ...extraFields,
    },
    updated_at: now,
  };
}

export function formatTriVolba(value: string | null | undefined) {
  if (value === "ano") return "Ano";
  if (value === "ne") return "Ne";
  return value || "—";
}

export function formatElektroZdrojTyp(value: string | null | undefined) {
  if (value === "pevna_pripojka") return "Pevná přípojka k síti";
  if (value === "elektrocentrala") return "Elektrocentrála";
  return value || "—";
}

export function formatStagePripojkaRezim(value: string | null | undefined) {
  if (value === "samostatna_pro_stage") return "Samostatná přípojka pro stage techniku";
  if (value === "sdilena_s_dalsimi_odbery") {
    return "Sdílená přípojka — stánky, catering apod.";
  }
  return value || "—";
}

export function formatPripojkyCounts(values: PoptavkaTechnikaFormValues) {
  const parts = PRIPOJKA_COUNT_FIELDS.map(({ key, label }) => {
    const count = values[key].trim();
    if (!count) return null;
    return `${count}× ${label}`;
  }).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
