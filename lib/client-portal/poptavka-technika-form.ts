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
  prijezd_az_ke_stage: string;
  prijezd_dodavka_35t: boolean;
  prijezd_nakladni_12t: boolean;
  prijezd_vzdalenost_od_stage_m: string;
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
  technik_vyjezd_kontakt_jmeno: string;
  technik_vyjezd_kontakt_telefon: string;
  technik_vyjezd_kontakt_email: string;
  technik_vyjezd_preferuje_telefon: boolean;
  technik_vyjezd_preferuje_email: boolean;
  technik_vyjezd_potvrzeni_fakturace: boolean;
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
  prijezd_az_ke_stage: "",
  prijezd_dodavka_35t: false,
  prijezd_nakladni_12t: false,
  prijezd_vzdalenost_od_stage_m: "",
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
  technik_vyjezd_kontakt_jmeno: "",
  technik_vyjezd_kontakt_telefon: "",
  technik_vyjezd_kontakt_email: "",
  technik_vyjezd_preferuje_telefon: false,
  technik_vyjezd_preferuje_email: false,
  technik_vyjezd_potvrzeni_fakturace: false,
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
    prijezd_az_ke_stage:
      normalizeLegacyAnoNe(extra.prijezd_az_ke_stage) ||
      normalizeLegacyAnoNe(extra.lze_zajet_autem),
    prijezd_dodavka_35t: Boolean(extra.prijezd_dodavka_35t),
    prijezd_nakladni_12t: Boolean(extra.prijezd_nakladni_12t),
    prijezd_vzdalenost_od_stage_m:
      extra.prijezd_vzdalenost_od_stage_m != null
        ? String(extra.prijezd_vzdalenost_od_stage_m)
        : "",
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
    technik_vyjezd_kontakt_jmeno: row.technik_vyjezd_kontakt_jmeno ?? "",
    technik_vyjezd_kontakt_telefon: row.technik_vyjezd_kontakt_telefon ?? "",
    technik_vyjezd_kontakt_email: row.technik_vyjezd_kontakt_email ?? "",
    technik_vyjezd_preferuje_telefon: Boolean(row.technik_vyjezd_preferuje_telefon),
    technik_vyjezd_preferuje_email: Boolean(row.technik_vyjezd_preferuje_email),
    technik_vyjezd_potvrzeni_fakturace: Boolean(row.technik_vyjezd_potvrzeni_fakturace_at),
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
    prijezd_az_ke_stage: parseAnoNe(formData.get("prijezd_az_ke_stage")),
    prijezd_dodavka_35t: formData.get("prijezd_dodavka_35t") === "on",
    prijezd_nakladni_12t: formData.get("prijezd_nakladni_12t") === "on",
    prijezd_vzdalenost_od_stage_m: String(
      formData.get("prijezd_vzdalenost_od_stage_m") ?? ""
    ).trim(),
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
    technik_vyjezd_kontakt_jmeno: String(formData.get("technik_vyjezd_kontakt_jmeno") ?? "").trim(),
    technik_vyjezd_kontakt_telefon: String(
      formData.get("technik_vyjezd_kontakt_telefon") ?? ""
    ).trim(),
    technik_vyjezd_kontakt_email: String(formData.get("technik_vyjezd_kontakt_email") ?? "").trim(),
    technik_vyjezd_preferuje_telefon: formData.get("technik_vyjezd_preferuje_telefon") === "on",
    technik_vyjezd_preferuje_email: formData.get("technik_vyjezd_preferuje_email") === "on",
    technik_vyjezd_potvrzeni_fakturace:
      formData.get("technik_vyjezd_potvrzeni_fakturace") === "on",
    lze_zajet_autem: parseAnoNe(formData.get("lze_zajet_autem")),
    misto_zpevnene: parseAnoNe(formData.get("misto_zpevnene")),
    kabel_pres_silnici: parseAnoNe(formData.get("kabel_pres_silnici")),
    vzdalenost_vykladka_stage: String(formData.get("vzdalenost_vykladka_stage") ?? "").trim(),
    pristup_pro_techniku: String(formData.get("pristup_pro_techniku") ?? "").trim(),
    omezeni_prujezdu: String(formData.get("omezeni_prujezdu") ?? "").trim(),
  };
}

function setCheckboxInFormData(formData: FormData, name: string, checked: boolean) {
  formData.delete(name);
  if (checked) {
    formData.set(name, "on");
  }
}

/** Sync React technika state into FormData so save works from step 4. */
export function appendTechnikaFormValuesToFormData(
  formData: FormData,
  values: PoptavkaTechnikaFormValues
) {
  formData.set("technicke_rezim", values.technicke_rezim);
  setCheckboxInFormData(formData, "technicke_potvrzeni_odpovednosti", values.technicke_potvrzeni_odpovednosti);
  setCheckboxInFormData(formData, "technicke_potvrzeni_vyjezd_ceny", values.technicke_potvrzeni_vyjezd_ceny);
  formData.set("elektro_zdroj_typ", values.elektro_zdroj_typ);
  formData.set("hlavni_chranic_vetve", values.hlavni_chranic_vetve);
  formData.set("pripojky_16a_count", values.pripojky_16a_count);
  formData.set("pripojky_32a_count", values.pripojky_32a_count);
  formData.set("pripojky_64a_count", values.pripojky_64a_count);
  formData.set("pripojky_125a_count", values.pripojky_125a_count);
  formData.set("stage_pripojka_rezim", values.stage_pripojka_rezim);
  formData.set("prijezd_poznamka", values.prijezd_poznamka);
  formData.set("prijezd_az_ke_stage", values.prijezd_az_ke_stage);
  setCheckboxInFormData(formData, "prijezd_dodavka_35t", values.prijezd_dodavka_35t);
  setCheckboxInFormData(formData, "prijezd_nakladni_12t", values.prijezd_nakladni_12t);
  formData.set("prijezd_vzdalenost_od_stage_m", values.prijezd_vzdalenost_od_stage_m);
  formData.set("parkovani_poznamka", values.parkovani_poznamka);
  formData.set("rozvadece_poznamka", values.rozvadece_poznamka);
  formData.set("elektro_pripojka", values.elektro_pripojka);
  formData.set("elektro_jisteni", values.elektro_jisteni);
  formData.set("elektro_zasuvka", values.elektro_zasuvka);
  formData.set("elektro_vzdalenost_m", values.elektro_vzdalenost_m);
  formData.set("kabelove_trasy", values.kabelove_trasy);
  formData.set("misto_stage", values.misto_stage);
  formData.set("misto_foh", values.misto_foh);
  formData.set("omezeni_hluku", values.omezeni_hluku);
  formData.set("casova_omezeni", values.casova_omezeni);
  formData.set("dalsi_poznamky", values.dalsi_poznamky);
  setCheckboxInFormData(formData, "pozadovan_vyjezd_technika", values.pozadovan_vyjezd_technika);
  formData.set("technik_vyjezd_kontakt_jmeno", values.technik_vyjezd_kontakt_jmeno);
  formData.set("technik_vyjezd_kontakt_telefon", values.technik_vyjezd_kontakt_telefon);
  formData.set("technik_vyjezd_kontakt_email", values.technik_vyjezd_kontakt_email);
  setCheckboxInFormData(formData, "technik_vyjezd_preferuje_telefon", values.technik_vyjezd_preferuje_telefon);
  setCheckboxInFormData(formData, "technik_vyjezd_preferuje_email", values.technik_vyjezd_preferuje_email);
  setCheckboxInFormData(formData, "technik_vyjezd_potvrzeni_fakturace", values.technik_vyjezd_potvrzeni_fakturace);
  formData.set("lze_zajet_autem", values.lze_zajet_autem);
  formData.set("misto_zpevnene", values.misto_zpevnene);
  formData.set("kabel_pres_silnici", values.kabel_pres_silnici);
  formData.set("vzdalenost_vykladka_stage", values.vzdalenost_vykladka_stage);
  formData.set("pristup_pro_techniku", values.pristup_pro_techniku);
  formData.set("omezeni_prujezdu", values.omezeni_prujezdu);
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
    technik_vyjezd_kontakt_jmeno: nullable(values.technik_vyjezd_kontakt_jmeno),
    technik_vyjezd_kontakt_telefon: nullable(values.technik_vyjezd_kontakt_telefon),
    technik_vyjezd_kontakt_email: nullable(values.technik_vyjezd_kontakt_email),
    technik_vyjezd_preferuje_telefon: values.technik_vyjezd_preferuje_telefon,
    technik_vyjezd_preferuje_email: values.technik_vyjezd_preferuje_email,
    technik_vyjezd_potvrzeni_fakturace_at:
      values.technik_vyjezd_potvrzeni_fakturace ? now : null,
    rizika: [],
    odpovedi_extra: {
      prijezd_az_ke_stage: values.prijezd_az_ke_stage || null,
      prijezd_dodavka_35t: values.prijezd_dodavka_35t,
      prijezd_nakladni_12t: values.prijezd_nakladni_12t,
      prijezd_vzdalenost_od_stage_m: toOptionalNumber(values.prijezd_vzdalenost_od_stage_m),
      lze_zajet_autem: values.prijezd_az_ke_stage || values.lze_zajet_autem || null,
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

export function formatPrijezdAzKeStage(
  technika: PoptavkaTechnikaFormValues,
  extra?: Record<string, unknown> | null
) {
  const volba =
    technika.prijezd_az_ke_stage ||
    (extra?.prijezd_az_ke_stage === "ano" || extra?.prijezd_az_ke_stage === "ne"
      ? String(extra.prijezd_az_ke_stage)
      : "") ||
    (extra?.lze_zajet_autem === "ano" || extra?.lze_zajet_autem === "ne"
      ? String(extra.lze_zajet_autem)
      : "");

  if (volba === "ano") {
    const vehicles: string[] = [];
    if (technika.prijezd_dodavka_35t || extra?.prijezd_dodavka_35t) {
      vehicles.push("dodávka do 3,5 t");
    }
    if (technika.prijezd_nakladni_12t || extra?.prijezd_nakladni_12t) {
      vehicles.push("nákladní vozidlo 12 t");
    }
    return vehicles.length ? `Ano — ${vehicles.join(", ")}` : "Ano";
  }

  if (volba === "ne") {
    const distance =
      technika.prijezd_vzdalenost_od_stage_m.trim() ||
      (extra?.prijezd_vzdalenost_od_stage_m != null
        ? String(extra.prijezd_vzdalenost_od_stage_m)
        : "");
    return distance ? `Ne — vzdálenost ${distance} m` : "Ne";
  }

  return null;
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

export function parseTechnikaJson(raw: string | null | undefined): PoptavkaTechnikaFormValues | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PoptavkaTechnikaFormValues>;
    return { ...EMPTY_POPTAVKA_TECHNIKA, ...parsed };
  } catch {
    return null;
  }
}
