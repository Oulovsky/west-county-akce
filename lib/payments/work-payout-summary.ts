import {
  buildWorkPayoutOverrideKey,
  type WorkPayoutOverrideRow,
} from "@/lib/admin/work-payout-override";
import {
  buildWorkPayoutBreakdown,
  type WorkPayoutBreakdownStatus,
} from "@/lib/payments/work-payout-breakdown";
import {
  formatMoneyCzk,
  getApprovedMinutes,
  getPaymentAmount,
  normalizePaymentStatus,
} from "@/lib/payments";
import { getTravelRowAmount, normalizeTravelStatus } from "@/lib/transport";

export type WorkPayoutIntervalRow = {
  zakazka_id: string;
  checkin_at: string | null;
  checkout_at: string | null;
  approved_duration_minutes?: number | string | null;
  payment_status?: string | null;
  zakazky?: { cislo_zakazky: string | null; nazev: string | null } | null;
};

export type EmployeeWorkPayoutStatus = "none" | "waiting" | "paid";

export type EmployeeWorkPayoutSummary = {
  zakazkaId: string;
  zakazkaTitle: string;
  calculatedAmountCzk: number;
  finalAmountCzk: number;
  correctionDeltaCzk: number | null;
  correctionNote: string | null;
  hasOverride: boolean;
  status: EmployeeWorkPayoutStatus;
  statusLabel: string;
};

function getZakazkaTitleFromRow(row: WorkPayoutIntervalRow) {
  return [row.zakazky?.cislo_zakazky, row.zakazky?.nazev].filter(Boolean).join(" · ") || "Zakázka";
}

export function getEmployeeWorkPayoutStatusLabel(status: EmployeeWorkPayoutStatus) {
  if (status === "waiting") return "Čeká na proplacení";
  if (status === "paid") return "Proplaceno";
  return "Nic k proplacení";
}

export function formatCorrectionDeltaCzk(calculated: number, final: number) {
  const delta = Math.round(final - calculated);
  if (delta === 0) return formatMoneyCzk(0);
  const formatted = formatMoneyCzk(Math.abs(delta));
  return delta > 0 ? `+${formatted}` : `−${formatted}`;
}

function sumIntervalAmounts(
  rows: WorkPayoutIntervalRow[],
  hourlyRate: number,
  paymentFilter?: "ceka_na_proplaceni" | "proplaceno"
) {
  return rows
    .filter((row) => Boolean(row.checkout_at))
    .filter((row) =>
      paymentFilter ? normalizePaymentStatus(row.payment_status) === paymentFilter : true
    )
    .reduce((sum, row) => {
      const approvedMinutes = getApprovedMinutes(row);
      return sum + getPaymentAmount(approvedMinutes, hourlyRate);
    }, 0);
}

function toBreakdownStatus(status: EmployeeWorkPayoutStatus): WorkPayoutBreakdownStatus {
  if (status === "waiting") return "waiting";
  if (status === "paid") return "paid";
  return "none";
}

/** Stejná logika souhrnu jako /admin/proplaceni (zakázka × zaměstnanec, čekající + override). */
export function buildEmployeeWorkPayoutSummaries({
  rows,
  userId,
  hourlyRate,
  overridesByKey,
  approvedTravelByZakazka,
}: {
  rows: WorkPayoutIntervalRow[];
  userId: string;
  hourlyRate: number;
  overridesByKey: Map<string, WorkPayoutOverrideRow>;
  approvedTravelByZakazka?: Map<string, number>;
}): EmployeeWorkPayoutSummary[] {
  const byZakazka = new Map<string, WorkPayoutIntervalRow[]>();

  for (const row of rows) {
    if (!row.checkout_at) continue;
    const list = byZakazka.get(row.zakazka_id) ?? [];
    list.push(row);
    byZakazka.set(row.zakazka_id, list);
  }

  const summaries: EmployeeWorkPayoutSummary[] = [];

  for (const [zakazkaId, zakazkaRows] of byZakazka) {
    const waitingRows = zakazkaRows.filter(
      (row) => normalizePaymentStatus(row.payment_status) === "ceka_na_proplaceni"
    );
    const paidRows = zakazkaRows.filter(
      (row) => normalizePaymentStatus(row.payment_status) === "proplaceno"
    );

    const calculatedWaiting = sumIntervalAmounts(zakazkaRows, hourlyRate, "ceka_na_proplaceni");
    const calculatedPaid = sumIntervalAmounts(zakazkaRows, hourlyRate, "proplaceno");

    const overrideRow = overridesByKey.get(buildWorkPayoutOverrideKey(zakazkaId, userId)) ?? null;
    const overrideAmount = overrideRow?.override_amount_czk ?? null;

    let status: EmployeeWorkPayoutStatus = "none";
    let calculatedWorkCzk = 0;

    if (waitingRows.length > 0) {
      status = "waiting";
      calculatedWorkCzk = calculatedWaiting;
    } else if (paidRows.length > 0) {
      status = "paid";
      calculatedWorkCzk = calculatedPaid;
    }

    const approvedTravelCzk = approvedTravelByZakazka?.get(zakazkaId) ?? 0;
    const breakdown = buildWorkPayoutBreakdown({
      calculatedWorkCzk,
      calculatedTravelCzk: approvedTravelCzk,
      overrideAmountCzk: overrideAmount,
      payoutStatus: toBreakdownStatus(status),
    });

    const appliesOverride = status === "waiting" && breakdown.hasOverride;

    summaries.push({
      zakazkaId,
      zakazkaTitle: getZakazkaTitleFromRow(zakazkaRows[0]),
      calculatedAmountCzk: breakdown.calculatedWorkCzk,
      finalAmountCzk: breakdown.finalCzk,
      correctionDeltaCzk: breakdown.correctionDeltaCzk,
      correctionNote: appliesOverride ? overrideRow?.correction_note ?? null : null,
      hasOverride: appliesOverride,
      status,
      statusLabel: getEmployeeWorkPayoutStatusLabel(status),
    });
  }

  return summaries.sort((a, b) => a.zakazkaTitle.localeCompare(b.zakazkaTitle, "cs"));
}

export type EmployeeTravelPayoutRow = {
  zakazka_id: string;
  status?: string | null;
  km: number | string;
  sazba_za_km: number | string;
  castka?: number | string | null;
};

/** Schválené cesty k proplacení (stejný stav jako admin „schvaleno“). */
export function buildApprovedTravelTotalsByZakazka(rows: EmployeeTravelPayoutRow[]) {
  const map = new Map<string, number>();

  for (const row of rows) {
    if (normalizeTravelStatus(row.status) !== "schvaleno") continue;
    const amount = getTravelRowAmount(row);
    map.set(row.zakazka_id, (map.get(row.zakazka_id) ?? 0) + amount);
  }

  return map;
}

/** Rozpad pro /moje — stejný helper jako admin proplacení. */
export function getEmployeeZakazkaPayoutBreakdown(
  summary: EmployeeWorkPayoutSummary,
  approvedTravelCzk: number
) {
  const breakdown = buildWorkPayoutBreakdown({
    calculatedWorkCzk: summary.calculatedAmountCzk,
    calculatedTravelCzk: approvedTravelCzk,
    overrideAmountCzk: summary.hasOverride ? summary.finalAmountCzk : null,
    payoutStatus:
      summary.status === "waiting" ? "waiting" : summary.status === "paid" ? "paid" : "none",
  });

  return {
    workCalculatedCzk: breakdown.calculatedWorkCzk,
    travelCzk: breakdown.calculatedTravelCzk,
    hasTravel: breakdown.hasTravel,
    calculatedCombinedCzk: breakdown.calculatedCombinedCzk,
    finalAmountCzk: summary.finalAmountCzk,
    correctionDeltaCzk: summary.correctionDeltaCzk,
  };
}
