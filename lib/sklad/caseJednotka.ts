export const SKLAD_CASE_JEDNOTKA = "case" as const;

export function normalizeSkladJednotkaKey(jednotka: string | null | undefined): string {
  return (jednotka ?? "").trim().toLowerCase();
}

export function isCaseJednotka(jednotka: string | null | undefined): boolean {
  return normalizeSkladJednotkaKey(jednotka) === SKLAD_CASE_JEDNOTKA;
}

export const CASE_NESTING_FORBIDDEN_MESSAGE =
  "Do tohoto kusu nelze vkládat další kusy. Vkládání je povoleno pouze u položek s jednotkou case." as const;
