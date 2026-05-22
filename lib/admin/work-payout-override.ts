export type WorkPayoutOverrideRow = {
  zakazka_id: string;
  user_id: string;
  override_amount_czk: number | string;
  correction_note: string | null;
  updated_by: string;
  updated_at: string;
};

export function buildWorkPayoutOverrideKey(zakazkaId: string, userId: string) {
  return `${zakazkaId}:${userId}`;
}

export function parseOverrideAmountCzk(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Korekce částky musí být nezáporné číslo.");
  }
  return Math.round(parsed * 100) / 100;
}

export function toOverrideAmountNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? NaN);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function resolveFinalPayoutAmount(
  calculatedAmount: number,
  overrideAmount: number | null | undefined
) {
  const override = toOverrideAmountNumber(overrideAmount);
  if (override === null) return calculatedAmount;
  return override;
}

export function hasPayoutOverride(overrideAmount: number | null | undefined) {
  return toOverrideAmountNumber(overrideAmount) !== null;
}
