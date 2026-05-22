import {
  buildWorkPayoutOverrideKey,
  resolveFinalPayoutAmount,
  toOverrideAmountNumber,
  type WorkPayoutOverrideRow,
} from "@/lib/admin/work-payout-override";
import {
  formatMoneyCzk,
  getApprovedMinutes,
  getPaymentAmount,
  normalizePaymentStatus,
} from "@/lib/payments";

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

/** Stejná logika souhrnu jako /admin/proplaceni (zakázka × zaměstnanec, čekající + override). */
export function buildEmployeeWorkPayoutSummaries({
  rows,
  userId,
  hourlyRate,
  overridesByKey,
}: {
  rows: WorkPayoutIntervalRow[];
  userId: string;
  hourlyRate: number;
  overridesByKey: Map<string, WorkPayoutOverrideRow>;
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
    const overrideAmount = toOverrideAmountNumber(overrideRow?.override_amount_czk);
    const hasOverride = overrideAmount !== null;

    let status: EmployeeWorkPayoutStatus = "none";
    let calculatedAmountCzk = 0;
    let finalAmountCzk = 0;

    if (waitingRows.length > 0) {
      status = "waiting";
      calculatedAmountCzk = calculatedWaiting;
      finalAmountCzk = resolveFinalPayoutAmount(calculatedWaiting, overrideAmount);
    } else if (paidRows.length > 0) {
      status = "paid";
      calculatedAmountCzk = calculatedPaid;
      finalAmountCzk = calculatedPaid;
    }

    const correctionDeltaCzk =
      status === "waiting" && hasOverride ? finalAmountCzk - calculatedAmountCzk : null;

    summaries.push({
      zakazkaId,
      zakazkaTitle: getZakazkaTitleFromRow(zakazkaRows[0]),
      calculatedAmountCzk,
      finalAmountCzk,
      correctionDeltaCzk,
      correctionNote: hasOverride ? overrideRow?.correction_note ?? null : null,
      hasOverride: status === "waiting" && hasOverride,
      status,
      statusLabel: getEmployeeWorkPayoutStatusLabel(status),
    });
  }

  return summaries.sort((a, b) => a.zakazkaTitle.localeCompare(b.zakazkaTitle, "cs"));
}
