import { getApprovedMinutes, getMeasuredMinutes, getPaymentAmount } from "@/lib/payments";
import {
  normalizeAttendancePhase,
  type AttendancePhase,
} from "@/lib/zakazka-attendance";

export const WORK_PAYOUT_PHASE_ORDER: AttendancePhase[] = ["nakladka", "stavba", "provoz", "bourani"];

export const WORK_PAYOUT_PHASE_LABEL: Record<AttendancePhase, string> = {
  nakladka: "Nakládka",
  stavba: "Stavění",
  provoz: "Provoz akce",
  bourani: "Bourání",
};

export type WorkIntervalLike = {
  typ_faze: string | null;
  checkin_at: string | null;
  checkout_at: string | null;
  approved_duration_minutes: number | string | null;
};

export type WorkPhaseSummary = {
  phase: AttendancePhase;
  label: string;
  measuredMinutes: number;
  approvedMinutes: number;
  amount: number;
  intervalCount: number;
  hasData: boolean;
};

export function buildWorkPhaseSummaries(
  rows: WorkIntervalLike[],
  hourlyRate: number
): WorkPhaseSummary[] {
  const buckets = new Map<
    AttendancePhase,
    { measuredMinutes: number; approvedMinutes: number; amount: number; intervalCount: number }
  >();

  for (const phase of WORK_PAYOUT_PHASE_ORDER) {
    buckets.set(phase, { measuredMinutes: 0, approvedMinutes: 0, amount: 0, intervalCount: 0 });
  }

  for (const row of rows) {
    const phase = normalizeAttendancePhase(row.typ_faze);
    const bucket = buckets.get(phase)!;
    const measuredMinutes = getMeasuredMinutes(row.checkin_at, row.checkout_at);
    const approvedMinutes = getApprovedMinutes(row);
    bucket.measuredMinutes += measuredMinutes;
    bucket.approvedMinutes += approvedMinutes;
    bucket.amount += getPaymentAmount(approvedMinutes, hourlyRate);
    bucket.intervalCount += 1;
  }

  return WORK_PAYOUT_PHASE_ORDER.map((phase) => {
    const bucket = buckets.get(phase)!;
    const hasData =
      bucket.intervalCount > 0 ||
      bucket.measuredMinutes > 0 ||
      bucket.approvedMinutes > 0 ||
      bucket.amount > 0;

    return {
      phase,
      label: WORK_PAYOUT_PHASE_LABEL[phase],
      measuredMinutes: bucket.measuredMinutes,
      approvedMinutes: bucket.approvedMinutes,
      amount: bucket.amount,
      intervalCount: bucket.intervalCount,
      hasData,
    };
  });
}

export type WorkPayoutProfile = {
  user_id?: string;
  jmeno: string | null;
  prijmeni: string | null;
  email: string | null;
  hodinovy_naklad_akce?: number | string | null;
  bank_account_number?: string | null;
  bank_code?: string | null;
  iban?: string | null;
};

export type WorkEmployeePayoutGroup = {
  key: string;
  zakazkaId: string;
  userId: string;
  zakazkaTitle: string;
  profile: WorkPayoutProfile | null;
  waitingTotal: number;
  phaseSummaries: WorkPhaseSummary[];
  payout: {
    account: { label: string; qrAccount: string } | null;
    message: string;
    qrDataUrl: string | null;
  };
};

export type WorkZakazkaPayoutTree = {
  zakazkaId: string;
  zakazkaTitle: string;
  waitingTotal: number;
  employees: WorkEmployeePayoutGroup[];
};

export function buildWorkZakazkaPayoutTree(
  groups: Array<{
    key: string;
    zakazkaId: string;
    userId: string;
    zakazkaTitle: string;
    profile: WorkEmployeePayoutGroup["profile"];
    groupItems: WorkIntervalLike[];
    hourlyRate: number;
    waitingTotal: number;
    account: WorkEmployeePayoutGroup["payout"]["account"];
    message: string;
    qrDataUrl: string | null;
  }>,
  getEmployeeName: (profile: WorkPayoutProfile | null, userId: string) => string
): WorkZakazkaPayoutTree[] {
  const byZakazka = new Map<string, WorkZakazkaPayoutTree>();

  for (const group of groups) {
    let zakazka = byZakazka.get(group.zakazkaId);
    if (!zakazka) {
      zakazka = {
        zakazkaId: group.zakazkaId,
        zakazkaTitle: group.zakazkaTitle,
        waitingTotal: 0,
        employees: [],
      };
      byZakazka.set(group.zakazkaId, zakazka);
    }

    zakazka.waitingTotal += group.waitingTotal;
    zakazka.employees.push({
      key: group.key,
      zakazkaId: group.zakazkaId,
      userId: group.userId,
      zakazkaTitle: group.zakazkaTitle,
      profile: group.profile,
      waitingTotal: group.waitingTotal,
      phaseSummaries: buildWorkPhaseSummaries(group.groupItems, group.hourlyRate),
      payout: {
        account: group.account,
        message: group.message,
        qrDataUrl: group.qrDataUrl,
      },
    });
  }

  return [...byZakazka.values()]
    .sort((a, b) => a.zakazkaTitle.localeCompare(b.zakazkaTitle, "cs"))
    .map((zakazka) => ({
      ...zakazka,
      employees: zakazka.employees.sort((a, b) =>
        getEmployeeName(a.profile, a.userId).localeCompare(getEmployeeName(b.profile, b.userId), "cs")
      ),
    }));
}
