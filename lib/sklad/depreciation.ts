export type DepreciationInput = {
  purchaseValue: number | string | null | undefined;
  purchaseDate: string | null | undefined;
  depreciationMonths: number | string | null | undefined;
  now?: Date;
};

export type DepreciationResult =
  | {
      ok: true;
      currentValue: number;
      elapsedMonths: number;
      remainingRatio: number;
    }
  | {
      ok: false;
      reason: string;
    };

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateLinearDepreciation({
  purchaseValue,
  purchaseDate,
  depreciationMonths,
  now = new Date(),
}: DepreciationInput): DepreciationResult {
  const value = toNumber(purchaseValue);
  const months = toNumber(depreciationMonths);

  if (value <= 0) return { ok: false, reason: "Chybí pořizovací hodnota" };
  if (!purchaseDate) return { ok: false, reason: "Chybí datum pořízení" };
  if (months <= 0) return { ok: false, reason: "Chybí odpisové pásmo" };

  const acquiredAt = new Date(`${purchaseDate}T00:00:00`);
  if (Number.isNaN(acquiredAt.getTime())) {
    return { ok: false, reason: "Neplatné datum pořízení" };
  }

  const elapsedMs = Math.max(now.getTime() - acquiredAt.getTime(), 0);
  const averageMonthMs = 1000 * 60 * 60 * 24 * 30.4375;
  const elapsedMonths = elapsedMs / averageMonthMs;
  const remainingRatio = Math.max((months - elapsedMonths) / months, 0);

  return {
    ok: true,
    currentValue: Math.round(value * remainingRatio),
    elapsedMonths,
    remainingRatio,
  };
}
