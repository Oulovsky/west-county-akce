import {
  getTravelRowAmount,
  normalizeTravelStatus,
  type TravelReimbursementStatus,
} from "@/lib/transport";
import type { PayoutEmployeeProfile } from "@/lib/admin/payout-profiles";

export type TravelReimbursementRow = {
  id: string;
  zakazka_id: string;
  user_id: string;
  zakazka_doprava_id: string | null;
  km: number | string;
  sazba_za_km: number | string;
  castka: number | string | null;
  odkud: string | null;
  kam: string | null;
  poznamka: string | null;
  status: string;
  submitted_at: string | null;
  paid_at: string | null;
  rejected_reason: string | null;
  zakazky?: { cislo_zakazky: string | null; nazev: string | null } | null;
};

export type TravelReimbursementItem = {
  row: TravelReimbursementRow;
  amount: number;
};

export type TravelEmployeePayoutGroup = {
  key: string;
  zakazkaId: string;
  userId: string;
  zakazkaTitle: string;
  profile: PayoutEmployeeProfile | null;
  pendingApprovalTotal: number;
  approvedForPaymentTotal: number;
  paidTotal: number;
  items: TravelReimbursementItem[];
  payout: {
    account: { label: string; qrAccount: string } | null;
    message: string;
    qrDataUrl: string | null;
  };
};

export type TravelZakazkaPayoutTree = {
  zakazkaId: string;
  zakazkaTitle: string;
  approvedForPaymentTotal: number;
  employees: TravelEmployeePayoutGroup[];
};

export function buildTravelPayoutGroupKey(zakazkaId: string, userId: string) {
  return `${zakazkaId}:${userId}`;
}

export function getTravelZakazkaTitle(row: Pick<TravelReimbursementRow, "zakazky">) {
  return [row.zakazky?.cislo_zakazky, row.zakazky?.nazev].filter(Boolean).join(" · ") || "Zakázka";
}

export function toTravelReimbursementItem(row: TravelReimbursementRow): TravelReimbursementItem {
  return {
    row,
    amount: getTravelRowAmount(row),
  };
}

export function sumTravelItemsByStatus(
  items: TravelReimbursementItem[],
  status: TravelReimbursementStatus
) {
  return items
    .filter((item) => normalizeTravelStatus(item.row.status) === status)
    .reduce((sum, item) => sum + item.amount, 0);
}

export function buildTravelZakazkaPayoutTree(
  groups: Array<{
    key: string;
    zakazkaId: string;
    userId: string;
    zakazkaTitle: string;
    profile: PayoutEmployeeProfile | null;
    items: TravelReimbursementItem[];
    pendingApprovalTotal: number;
    approvedForPaymentTotal: number;
    paidTotal: number;
    account: TravelEmployeePayoutGroup["payout"]["account"];
    message: string;
    qrDataUrl: string | null;
  }>,
  getEmployeeName: (profile: PayoutEmployeeProfile | null, userId: string) => string
): TravelZakazkaPayoutTree[] {
  const byZakazka = new Map<string, TravelZakazkaPayoutTree>();

  for (const group of groups) {
    let zakazka = byZakazka.get(group.zakazkaId);
    if (!zakazka) {
      zakazka = {
        zakazkaId: group.zakazkaId,
        zakazkaTitle: group.zakazkaTitle,
        approvedForPaymentTotal: 0,
        employees: [],
      };
      byZakazka.set(group.zakazkaId, zakazka);
    }

    zakazka.approvedForPaymentTotal += group.approvedForPaymentTotal;
    zakazka.employees.push({
      key: group.key,
      zakazkaId: group.zakazkaId,
      userId: group.userId,
      zakazkaTitle: group.zakazkaTitle,
      profile: group.profile,
      pendingApprovalTotal: group.pendingApprovalTotal,
      approvedForPaymentTotal: group.approvedForPaymentTotal,
      paidTotal: group.paidTotal,
      items: [...group.items].sort((a, b) => {
        const aTime = new Date(a.row.submitted_at ?? 0).getTime();
        const bTime = new Date(b.row.submitted_at ?? 0).getTime();
        return bTime - aTime;
      }),
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

/** Součet schválených částek napříč stromem (pro horní statistiky). */
export function sumTravelTreeApprovedTotal(tree: TravelZakazkaPayoutTree[]) {
  return tree.reduce((sum, zakazka) => sum + zakazka.approvedForPaymentTotal, 0);
}

export function sumTravelRowsByStatus(rows: TravelReimbursementRow[], status: TravelReimbursementStatus) {
  return rows
    .filter((row) => normalizeTravelStatus(row.status) === status)
    .reduce((sum, row) => sum + getTravelRowAmount(row), 0);
}
