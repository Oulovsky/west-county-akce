import {
  resolveFinalPayoutAmount,
  toOverrideAmountNumber,
} from "@/lib/admin/work-payout-override";

export type WorkPayoutBreakdownStatus = "waiting" | "paid" | "none";

export type WorkPayoutBreakdown = {
  calculatedWorkCzk: number;
  calculatedTravelCzk: number;
  calculatedCombinedCzk: number;
  finalCzk: number;
  correctionDeltaCzk: number | null;
  hasTravel: boolean;
  hasOverride: boolean;
};

/** Jednotný výpočet práce + cest + override (admin i zaměstnanec). */
export function buildWorkPayoutBreakdown({
  calculatedWorkCzk,
  calculatedTravelCzk = 0,
  overrideAmountCzk,
  payoutStatus,
}: {
  calculatedWorkCzk: number;
  calculatedTravelCzk?: number;
  overrideAmountCzk?: number | string | null;
  payoutStatus: WorkPayoutBreakdownStatus;
}): WorkPayoutBreakdown {
  const travel = Math.max(0, calculatedTravelCzk);
  const combined = calculatedWorkCzk + travel;
  const overrideAmount = toOverrideAmountNumber(overrideAmountCzk);
  const hasOverride = overrideAmount !== null;
  const hasTravel = travel > 0.005;

  if (payoutStatus === "paid") {
    return {
      calculatedWorkCzk,
      calculatedTravelCzk: travel,
      calculatedCombinedCzk: combined,
      finalCzk: calculatedWorkCzk,
      correctionDeltaCzk: null,
      hasTravel,
      hasOverride: false,
    };
  }

  if (payoutStatus === "waiting") {
    const finalCzk = resolveFinalPayoutAmount(combined, overrideAmount);
    return {
      calculatedWorkCzk,
      calculatedTravelCzk: travel,
      calculatedCombinedCzk: combined,
      finalCzk,
      correctionDeltaCzk: hasOverride ? Math.round(finalCzk - combined) : null,
      hasTravel,
      hasOverride,
    };
  }

  return {
    calculatedWorkCzk,
    calculatedTravelCzk: travel,
    calculatedCombinedCzk: combined,
    finalCzk: 0,
    correctionDeltaCzk: null,
    hasTravel,
    hasOverride: false,
  };
}
