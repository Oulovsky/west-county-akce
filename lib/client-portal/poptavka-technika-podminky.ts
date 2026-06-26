import type { PoptavkaTechnickeUdaje } from "@/lib/client-portal/types";
import type { PoptavkaFotkaTyp } from "@/lib/client-portal/types";

export const TECHNICKE_REZIMY = ["klient_vyplni", "vyjezd_technika"] as const;
export type TechnickeRezim = (typeof TECHNICKE_REZIMY)[number];

export const TECHNICKE_REZIM_LABELS: Record<TechnickeRezim, string> = {
  klient_vyplni: "Klient vyplní technické informace sám",
  vyjezd_technika: "Požadován výjezd technika",
};

export const ODPovednosti_UPOZORNENI =
  "Technické informace musí být vyplněny pravdivě a úplně. Pokud budou uvedené informace nepravdivé, neúplné nebo zavádějící a způsobí komplikace při realizaci zakázky, může být postupováno podle smluvních podmínek včetně účtování vícenákladů nebo smluvních sankcí.";

export const VYJEZD_UPOZORNENI =
  "Požadujete výjezd technika WEST COUNTY pro kontrolu technických podmínek na místě. Výjezd technika je zpoplatněn částkou 500 Kč / hod práce na místě + cestovní náklady 7 Kč / km z centrály Karlovy Vary, minimálně však 3 000 Kč.";

export const VYJEZD_CENIK_LINES = [
  "500 Kč / hod práce technika na místě",
  "7 Kč / km cestovní náklady z centrály Karlovy Vary",
  "Minimální cena výjezdu: 3 000 Kč",
] as const;

export type TechnikaSectionPhotoKey =
  | "rozvadec"
  | "prijezd"
  | "plocha_stage"
  | "povrch_pristup"
  | "jina"
  | "misto_akce";

export const TECHNIKA_SECTION_PHOTOS: {
  key: TechnikaSectionPhotoKey;
  typ: PoptavkaFotkaTyp;
  label: string;
  captureLabel: string;
  uploadLabel: string;
}[] = [
  {
    key: "rozvadec",
    typ: "rozvadec",
    label: "Fotka rozvaděče",
    captureLabel: "Vyfotit rozvaděč",
    uploadLabel: "Nahrát fotku",
  },
  {
    key: "prijezd",
    typ: "prijezd",
    label: "Fotka příjezdu",
    captureLabel: "Vyfotit příjezd",
    uploadLabel: "Nahrát fotku",
  },
  {
    key: "plocha_stage",
    typ: "plocha_stage",
    label: "Fotka místa stavby / stage",
    captureLabel: "Vyfotit místo stavby",
    uploadLabel: "Nahrát fotku",
  },
  {
    key: "povrch_pristup",
    typ: "povrch_pristup",
    label: "Fotka povrchu a přístupu",
    captureLabel: "Vyfotit povrch a přístup",
    uploadLabel: "Nahrát fotku",
  },
  {
    key: "jina",
    typ: "jina",
    label: "Fotka překážek / průjezdu",
    captureLabel: "Vyfotit překážky / průjezd",
    uploadLabel: "Nahrát fotku",
  },
  {
    key: "misto_akce",
    typ: "misto_akce",
    label: "Fotka parkování",
    captureLabel: "Vyfotit parkování",
    uploadLabel: "Nahrát fotku",
  },
];

export function technickeRezimFromRecord(
  row: PoptavkaTechnickeUdaje | null | undefined
): TechnickeRezim | null {
  if (!row) return null;
  if (row.technicke_rezim === "klient_vyplni" || row.technicke_rezim === "vyjezd_technika") {
    return row.technicke_rezim;
  }
  if (row.pozadovan_vyjezd_technika) return "vyjezd_technika";
  if (
    row.technicke_potvrzeni_odpovednosti_at ||
    row.prijezd_poznamka ||
    row.rozvadece_poznamka
  ) {
    return "klient_vyplni";
  }
  return null;
}

export function formatTechnickePotvrzeni(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString("cs-CZ");
  } catch {
    return value;
  }
}

import type { PoptavkaTechnikaFormValues } from "@/lib/client-portal/poptavka-technika-form";
import { PRIPOJKA_COUNT_FIELDS } from "@/lib/client-portal/poptavka-technika-form";

function isValidCount(value: string) {
  const text = value.trim();
  if (!text) return false;
  const number = Number(text);
  return Number.isInteger(number) && number >= 0;
}

function isAnoNe(value: string) {
  return value === "ano" || value === "ne";
}

export function validateTechnickePodminkyForSave(input: {
  wizardStep: number;
  technickeRezim: string;
  potvrzeniOdpovednosti: boolean;
  potvrzeniVyjezdCeny: boolean;
  technika?: PoptavkaTechnikaFormValues;
}): string | null {
  if (input.wizardStep < 4) return null;

  const rezim = input.technickeRezim.trim();
  if (rezim !== "klient_vyplni" && rezim !== "vyjezd_technika") {
    return "technicke_missing_rezim";
  }

  if (rezim === "klient_vyplni" && !input.potvrzeniOdpovednosti) {
    return "technicke_missing_potvrzeni";
  }

  if (rezim === "vyjezd_technika" && !input.potvrzeniVyjezdCeny) {
    return "technicke_missing_potvrzeni_vyjezd";
  }

  if (rezim !== "klient_vyplni" || !input.technika) {
    return null;
  }

  const technika = input.technika;

  if (technika.elektro_zdroj_typ !== "pevna_pripojka" && technika.elektro_zdroj_typ !== "elektrocentrala") {
    return "technicke_elektro_missing_zdroj";
  }

  if (!technika.hlavni_chranic_vetve.trim()) {
    return "technicke_elektro_missing_chranic";
  }

  for (const field of PRIPOJKA_COUNT_FIELDS) {
    if (!isValidCount(technika[field.key])) {
      return "technicke_elektro_missing_pripojky";
    }
  }

  if (
    technika.stage_pripojka_rezim !== "samostatna_pro_stage" &&
    technika.stage_pripojka_rezim !== "sdilena_s_dalsimi_odbery"
  ) {
    return "technicke_elektro_missing_stage_pripojka";
  }

  if (
    !isAnoNe(technika.lze_zajet_autem) ||
    !isAnoNe(technika.misto_zpevnene) ||
    !isAnoNe(technika.kabel_pres_silnici)
  ) {
    return "technicke_missing_ano_ne";
  }

  return null;
}
