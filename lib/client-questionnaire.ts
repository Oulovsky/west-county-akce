import { createHash, randomBytes } from "crypto";

export type QuestionnaireDecision = "self" | "technician_visit";

export function createClientQuestionnaireToken() {
  return randomBytes(32).toString("base64url");
}

export function hashClientQuestionnaireToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeBaseUrl(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, "");
  return trimmed || "";
}

export function buildQuestionnaireUrl(baseUrl: string, rawToken: string) {
  return `${normalizeBaseUrl(baseUrl)}/dotaznik/${encodeURIComponent(rawToken)}`;
}

export function getRiskCodes(input: {
  decision: QuestionnaireDecision;
  lzeZajetAutem?: string;
  mistoZpevnene?: string;
  elektroPripravena?: string;
  elektroPripojka: string;
  elektroJisteni: string;
  elektroZasuvka: string;
  elektroVzdalenostM: number | null;
  kabelPresSilnici?: string;
  parkovaniPoznamka?: string;
}) {
  const risks: string[] = [];

  if (input.decision === "technician_visit") {
    risks.push("pozadovan_vyjezd");
  }

  const elektroText = [
    input.elektroPripojka,
    input.elektroJisteni,
    input.elektroZasuvka,
    input.elektroPripravena ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("cs-CZ");

  if (input.lzeZajetAutem === "nevim") {
    risks.push("prijezd_nejasny");
  }

  if (input.mistoZpevnene === "nevim" || !input.parkovaniPoznamka?.trim()) {
    risks.push("parkovani_nejasne");
  }

  if (input.elektroPripravena === "ne") {
    risks.push("elektro_nepripravena");
  }

  if (input.kabelPresSilnici === "ano") {
    risks.push("kabel_pres_silnici");
  }

  if (input.elektroVzdalenostM != null && input.elektroVzdalenostM > 50) {
    risks.push("vzdalenost_gt_50m");
  }

  if (
    input.elektroPripravena === "nevim" ||
    input.elektroZasuvka === "nevim" ||
    elektroText.includes("nevím") ||
    elektroText.includes("nevim") ||
    elektroText.includes("netuším")
  ) {
    risks.push("elektro_nevim");
  }

  return [...new Set(risks)];
}
