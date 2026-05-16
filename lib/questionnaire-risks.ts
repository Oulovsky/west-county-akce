export const QUESTIONNAIRE_RISK_LABELS: Record<string, string> = {
  pozadovan_vyjezd: "Klient požaduje výjezd technika",
  prijezd_nejasny: "Není jasný příjezd autem",
  parkovani_nejasne: "Nejasné parkování nebo manipulační prostor",
  elektro_nepripravena: "Elektro není připravené",
  kabel_pres_silnici: "Kabel povede přes komunikaci nebo průchod",
  vzdalenost_gt_50m: "Elektro přípojka je dál než 50 metrů",
  elektro_nevim: "Nejasné informace o elektro přípojce",
};

export function normalizeQuestionnaireRiskCodes(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function getQuestionnaireRiskLabel(code: string) {
  return QUESTIONNAIRE_RISK_LABELS[code] ?? code;
}

export function formatQuestionnaireRiskCount(count: number) {
  if (count === 0) return "Žádná upozornění";
  if (count === 1) return "1 upozornění";
  if (count >= 2 && count <= 4) return `${count} upozornění`;
  return `${count} upozornění`;
}

export function isPrimaryQuestionnaireRisk(code: string) {
  return code === "pozadovan_vyjezd";
}
