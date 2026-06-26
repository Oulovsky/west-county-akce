import type { PoptavkaTechnickeUdaje } from "@/lib/client-portal/types";
import type { TechnickeRezim } from "@/lib/client-portal/poptavka-technika-podminky";

export type PoptavkaTechnikaFormValues = {
  technicke_rezim: TechnickeRezim | "";
  technicke_potvrzeni_odpovednosti: boolean;
  technicke_potvrzeni_vyjezd_ceny: boolean;
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
  lze_zajet_autem: "nevim",
  misto_zpevnene: "nevim",
  kabel_pres_silnici: "nevim",
  vzdalenost_vykladka_stage: "",
  pristup_pro_techniku: "",
  omezeni_prujezdu: "",
};

export const ELEKTRO_ZASUVKA_OPTIONS = [
  "230V běžná zásuvka",
  "16A 5pin",
  "32A 5pin",
  "63A 5pin",
  "nevim",
  "Jiné",
] as const;

export const TRIZVOLBA_OPTIONS = [
  ["ano", "Ano"],
  ["ne", "Ne"],
  ["nevim", "Nevím"],
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

function normalizeChoice(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || "nevim";
}

function parseTechnickeRezim(value: FormDataEntryValue | null): TechnickeRezim | "" {
  const text = String(value ?? "").trim();
  if (text === "klient_vyplni" || text === "vyjezd_technika") return text;
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

  return {
    technicke_rezim: rezim,
    technicke_potvrzeni_odpovednosti: Boolean(row.technicke_potvrzeni_odpovednosti_at),
    technicke_potvrzeni_vyjezd_ceny: Boolean(row.technicke_potvrzeni_vyjezd_ceny_at),
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
    lze_zajet_autem: String(extra.lze_zajet_autem ?? "nevim"),
    misto_zpevnene: String(extra.misto_zpevnene ?? "nevim"),
    kabel_pres_silnici: String(extra.kabel_pres_silnici ?? "nevim"),
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
    lze_zajet_autem: normalizeChoice(formData.get("lze_zajet_autem")),
    misto_zpevnene: normalizeChoice(formData.get("misto_zpevnene")),
    kabel_pres_silnici: normalizeChoice(formData.get("kabel_pres_silnici")),
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
    elektro_jisteni: nullable(values.elektro_jisteni),
    elektro_zasuvka: nullable(values.elektro_zasuvka),
    elektro_vzdalenost_m: toOptionalNumber(values.elektro_vzdalenost_m),
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
      lze_zajet_autem: values.lze_zajet_autem,
      misto_zpevnene: values.misto_zpevnene,
      kabel_pres_silnici: values.kabel_pres_silnici,
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
  if (value === "nevim") return "Nevím";
  return value || "—";
}
