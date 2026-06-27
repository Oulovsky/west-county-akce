import type { SetupOblast } from "@/lib/client-portal/types";
import {
  buildLogistikaOknaRowPayload,
  parseLogistikaOknaFromFormData,
  type LogistikaOknoValues,
} from "@/lib/logistika-okna";

export const TYP_AKCE_OPTIONS = [
  { value: "koncert", label: "Koncert" },
  { value: "festival", label: "Festival" },
  { value: "firemni_akce", label: "Firemní akce" },
  { value: "svatba", label: "Svatba" },
  { value: "galavecer", label: "Galavečer" },
  { value: "sport", label: "Sportovní akce" },
  { value: "konference", label: "Konference" },
  { value: "jine", label: "Jiné" },
] as const;

export type PoptavkaSetupInput = {
  setup_id: string;
  mnozstvi: number;
  poznamka_klienta: string | null;
};

export type PoptavkaMistoSource = "new" | "saved";

export type PoptavkaFormValues = {
  kontakt_jmeno: string;
  kontakt_telefon: string;
  kontakt_email: string;
  misto_nazev: string;
  typ_akce: string;
  misto_adresa: string;
  presny_popis_mista: string;
  datum_od: string;
  datum_do: string;
  cas_programu_od: string;
  cas_programu_do: string;
  misto_poznamka: string;
  misto_source: PoptavkaMistoSource;
  misto_id: string | null;
  misto_lat: number | null;
  misto_lng: number | null;
  setupy: PoptavkaSetupInput[];
} & LogistikaOknoValues;

export type PoptavkaPrefill = {
  kontakt_jmeno: string;
  kontakt_telefon: string;
  kontakt_email: string;
  firma_nazev: string;
  firma_ico: string;
};

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

function parseMistoSource(value: string): PoptavkaMistoSource {
  return value === "saved" ? "saved" : "new";
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSetupSelections(raw: string): PoptavkaSetupInput[] {
  if (!raw.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_SETUPS");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("INVALID_SETUPS");
  }

  const result: PoptavkaSetupInput[] = [];
  const seen = new Set<string>();

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const setupId = String((item as { setup_id?: unknown }).setup_id ?? "").trim();
    const mnozstviRaw = Number((item as { mnozstvi?: unknown }).mnozstvi ?? 0);
    const poznamka = String((item as { poznamka_klienta?: unknown }).poznamka_klienta ?? "").trim();

    if (!setupId || seen.has(setupId)) continue;
    if (!Number.isFinite(mnozstviRaw) || mnozstviRaw < 1) continue;

    seen.add(setupId);
    result.push({
      setup_id: setupId,
      mnozstvi: Math.floor(mnozstviRaw),
      poznamka_klienta: poznamka || null,
    });
  }

  return result;
}

export function parsePoptavkaFormData(formData: FormData): PoptavkaFormValues {
  const mistoSource = parseMistoSource(String(formData.get("misto_source") ?? "new"));
  const rawMistoId = nullable(String(formData.get("misto_id") ?? ""));

  return {
    kontakt_jmeno: String(formData.get("kontakt_jmeno") ?? "").trim(),
    kontakt_telefon: String(formData.get("kontakt_telefon") ?? "").trim(),
    kontakt_email: String(formData.get("kontakt_email") ?? "").trim(),
    misto_nazev: String(formData.get("misto_nazev") ?? "").trim(),
    typ_akce: String(formData.get("typ_akce") ?? "").trim(),
    misto_adresa: String(formData.get("misto_adresa") ?? "").trim(),
    presny_popis_mista: String(formData.get("presny_popis_mista") ?? "").trim(),
    datum_od: String(formData.get("datum_od") ?? "").trim(),
    datum_do: String(formData.get("datum_do") ?? "").trim(),
    cas_programu_od: String(formData.get("cas_programu_od") ?? "").trim(),
    cas_programu_do: String(formData.get("cas_programu_do") ?? "").trim(),
    misto_poznamka: String(formData.get("misto_poznamka") ?? "").trim(),
    misto_source: mistoSource,
    misto_id: mistoSource === "saved" ? rawMistoId : null,
    misto_lat: parseOptionalNumber(String(formData.get("misto_lat") ?? "")),
    misto_lng: parseOptionalNumber(String(formData.get("misto_lng") ?? "")),
    setupy: parseSetupSelections(String(formData.get("setupy_json") ?? "")),
    ...parseLogistikaOknaFromFormData(formData),
  };
}

/** Sync React form state into FormData so save works from any wizard step. */
export function appendPoptavkaFormValuesToFormData(
  formData: FormData,
  values: PoptavkaFormValues
) {
  formData.set("kontakt_jmeno", values.kontakt_jmeno);
  formData.set("kontakt_telefon", values.kontakt_telefon);
  formData.set("kontakt_email", values.kontakt_email);
  formData.set("misto_nazev", values.misto_nazev);
  formData.set("typ_akce", values.typ_akce);
  formData.set("misto_adresa", values.misto_adresa);
  formData.set("presny_popis_mista", values.presny_popis_mista);
  formData.set("datum_od", values.datum_od);
  formData.set("datum_do", values.datum_do);
  formData.set("cas_programu_od", values.cas_programu_od);
  formData.set("cas_programu_do", values.cas_programu_do);
  formData.set("misto_poznamka", values.misto_poznamka);
  formData.set("misto_source", values.misto_source);
  formData.set("misto_id", values.misto_id ?? "");
  formData.set("misto_lat", values.misto_lat != null ? String(values.misto_lat) : "");
  formData.set("misto_lng", values.misto_lng != null ? String(values.misto_lng) : "");
  formData.set("stavba_okno_od", values.stavba_okno_od);
  formData.set("stavba_okno_do", values.stavba_okno_do);
  formData.set("bourani_okno_od", values.bourani_okno_od);
  formData.set("bourani_okno_do", values.bourani_okno_do);
  formData.set("logistika_poznamka_klienta", values.logistika_poznamka_klienta);
}

export function validatePoptavkaDraftMinima(values: PoptavkaFormValues): string | null {
  if (!values.misto_nazev.trim()) return "draft_missing_title";
  if (!values.datum_od) return "draft_missing_date";
  return null;
}

export function validatePoptavkaForm(values: PoptavkaFormValues): string | null {
  return validatePoptavkaDraftMinima(values);
}

export function buildPoptavkaRowPayload(
  values: PoptavkaFormValues,
  options?: { wizardKrok?: number | null }
) {
  const viceDenni = values.datum_od && values.datum_do ? values.datum_od !== values.datum_do : false;

  return {
    kontakt_jmeno: nullable(values.kontakt_jmeno),
    kontakt_telefon: nullable(values.kontakt_telefon),
    kontakt_email: nullable(values.kontakt_email),
    misto_id: values.misto_id,
    misto_nazev: nullable(values.misto_nazev),
    typ_akce: nullable(values.typ_akce),
    misto_adresa: nullable(values.misto_adresa),
    presny_popis_mista: nullable(values.presny_popis_mista),
    misto_lat: values.misto_lat,
    misto_lng: values.misto_lng,
    datum_od: nullable(values.datum_od),
    datum_do: nullable(values.datum_do),
    cas_programu_od: normalizeTime(values.cas_programu_od),
    cas_programu_do: normalizeTime(values.cas_programu_do),
    misto_poznamka: nullable(values.misto_poznamka),
    vice_denni: viceDenni,
    wizard_krok: options?.wizardKrok ?? null,
    ...buildLogistikaOknaRowPayload(values),
    updated_at: new Date().toISOString(),
  };
}

export function formatTypAkce(value: string | null | undefined) {
  if (!value) return "—";
  return TYP_AKCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function formatPoptavkaDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatPoptavkaTime(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 5);
}

export function formatPoptavkaDateRange(
  datumOd: string | null | undefined,
  datumDo: string | null | undefined
) {
  if (!datumOd && !datumDo) return "—";
  if (datumOd === datumDo || !datumDo) {
    return formatPoptavkaDate(datumOd);
  }
  return `${formatPoptavkaDate(datumOd)} – ${formatPoptavkaDate(datumDo)}`;
}

export function groupSetupInputsByOblast(
  setupy: PoptavkaSetupInput[],
  setupMeta: Map<string, { oblast: SetupOblast; nazev: string }>
) {
  const groups = new Map<SetupOblast, Array<PoptavkaSetupInput & { nazev: string }>>();

  for (const row of setupy) {
    const meta = setupMeta.get(row.setup_id);
    if (!meta) continue;
    const current = groups.get(meta.oblast) ?? [];
    current.push({ ...row, nazev: meta.nazev });
    groups.set(meta.oblast, current);
  }

  return groups;
}
