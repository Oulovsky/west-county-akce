export type ClientPortalMistoSummary = {
  misto_id: string;
  nazev: string;
  adresa_text: string | null;
  lat: number | null;
  lng: number | null;
  poznamka: string | null;
  updated_at: string;
};

export type ClientPortalMistoTechnickaPoznamka = {
  id: string;
  typ: string;
  text: string;
  dulezite: boolean;
  created_at: string;
};

export type ClientPortalMistoTechnickaFotka = {
  id: string;
  typ: string;
  popis: string | null;
  signedUrl: string | null;
  created_at: string;
};

export type ClientPortalMistoKnowHow = {
  poznamky: ClientPortalMistoTechnickaPoznamka[];
  fotky: ClientPortalMistoTechnickaFotka[];
  loadError?: boolean;
};

const MISTO_POZNAMKA_TYP_LABELS: Record<string, string> = {
  elektro: "Elektro",
  prijezd: "Příjezd",
  parkovani: "Parkování",
  stage: "Stage",
  hluk: "Hluk",
  omezeni: "Omezení",
  tip: "Tip",
  problem: "Problém",
  revize_objednavka: "Revize objednávky",
  jina: "Jiná",
};

const MISTO_FOTKA_TYP_LABELS: Record<string, string> = {
  rozvadec: "Rozvaděč",
  prijezd: "Příjezd",
  parkovani: "Parkování",
  kabel: "Kabelová trasa",
  stage: "Stage prostor",
  plocha_stage: "Plocha pro stage",
  misto_akce: "Místo akce",
  foh: "FOH",
  led: "LED",
  omezeni: "Omezení",
  problem: "Problém",
  jina: "Jiná",
};

export function formatMistoTechnickaPoznamkaTyp(typ: string) {
  return MISTO_POZNAMKA_TYP_LABELS[typ] ?? typ.replaceAll("_", " ");
}

export function formatMistoTechnickaFotkaTyp(typ: string) {
  return MISTO_FOTKA_TYP_LABELS[typ] ?? typ.replaceAll("_", " ");
}

export function formatMistoKnowHowDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}
