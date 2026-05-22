import { isApprovalResolved, normalizeApprovalStatus } from "@/lib/approval";
import { hasPaymentAccount, type BankProfile } from "@/lib/bank-account";
import { normalizePaymentStatus } from "@/lib/payments";

export type WorkIntervalRow = {
  id: string;
  zakazka_id: string;
  user_id: string;
  typ_faze: string | null;
  doprava_rezim?: string | null;
  checkin_at: string | null;
  checkout_at: string | null;
  claimed_duration_minutes?: number | string | null;
  claimed_amount_czk?: number | string | null;
  approved_duration_minutes?: number | string | null;
  approved_amount_czk?: number | string | null;
  approval_status?: string | null;
  payment_status?: string | null;
  correction_note?: string | null;
};

export type TravelClaimRow = {
  id: string;
  zakazka_id: string;
  user_id: string;
  claimed_km?: number | string | null;
  km?: number | string | null;
  claimed_amount_czk?: number | string | null;
  approved_km?: number | string | null;
  approved_amount_czk?: number | string | null;
  approval_status?: string | null;
  payment_status?: string | null;
  correction_note?: string | null;
  doprava_rezim?: string | null;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumAmount(rows: Array<{ approved_amount_czk?: number | string | null }>) {
  return rows.reduce((sum, row) => sum + toNumber(row.approved_amount_czk), 0);
}

export type PayoutGroupState = {
  openCheckins: WorkIntervalRow[];
  closedWork: WorkIntervalRow[];
  pendingWork: WorkIntervalRow[];
  pendingTravel: TravelClaimRow[];
  payableWork: WorkIntervalRow[];
  payableTravel: TravelClaimRow[];
  allClosedResolved: boolean;
  hasPayable: boolean;
  workTotal: number;
  travelTotal: number;
  total: number;
  canShowPayout: boolean;
  hasBankAccount: boolean;
};

export function getPayoutGroupState({
  workRows,
  travelRows,
  bankProfile,
}: {
  workRows: WorkIntervalRow[];
  travelRows: TravelClaimRow[];
  bankProfile?: BankProfile | null;
}): PayoutGroupState {
  const openCheckins = workRows.filter((row) => !row.checkout_at);
  const closedWork = workRows.filter((row) => Boolean(row.checkout_at));

  const pendingWork = closedWork.filter(
    (row) => normalizeApprovalStatus(row.approval_status) === "ceka_na_schvaleni"
  );
  const pendingTravel = travelRows.filter(
    (row) => normalizeApprovalStatus(row.approval_status) === "ceka_na_schvaleni"
  );

  const payableWork = closedWork.filter(
    (row) =>
      normalizeApprovalStatus(row.approval_status) === "schvaleno" &&
      normalizePaymentStatus(row.payment_status) === "ceka_na_proplaceni"
  );
  const payableTravel = travelRows.filter(
    (row) =>
      normalizeApprovalStatus(row.approval_status) === "schvaleno" &&
      normalizePaymentStatus(row.payment_status) === "ceka_na_proplaceni"
  );

  const allClosedResolved =
    pendingWork.length === 0 &&
    pendingTravel.length === 0 &&
    closedWork.every((row) => isApprovalResolved(row.approval_status)) &&
    travelRows.every((row) => isApprovalResolved(row.approval_status));

  const workTotal = sumAmount(payableWork);
  const travelTotal = sumAmount(payableTravel);
  const total = workTotal + travelTotal;
  const hasPayable = payableWork.length + payableTravel.length > 0;
  const hasBank = hasPaymentAccount(bankProfile);

  const canShowPayout = allClosedResolved && hasPayable && total > 0 && hasBank;

  return {
    openCheckins,
    closedWork,
    pendingWork,
    pendingTravel,
    payableWork,
    payableTravel,
    allClosedResolved,
    hasPayable,
    workTotal,
    travelTotal,
    total,
    canShowPayout,
    hasBankAccount: hasBank,
  };
}

export function buildPayoutGroupKey(zakazkaId: string, userId: string) {
  return `${zakazkaId}:${userId}`;
}

export function parsePayoutGroupKey(key: string) {
  const [zakazkaId, userId] = key.split(":");
  return { zakazkaId, userId };
}
