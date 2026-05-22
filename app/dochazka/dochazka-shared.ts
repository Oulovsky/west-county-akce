import { isPrepravaTypBloku } from "@/lib/zakazka-attendance";
import {
  formatAssignmentRange,
  getAssignmentLogisticsStatusLabel,
  getAssignmentPhaseSortIndex,
  isAssignmentLogisticsPhase,
} from "@/lib/employee/assignment-display";

export type DochazkaAssignmentRow = {
  id: string;
  zakazka_id: string;
  datum_od: string | null;
  datum_do: string | null;
  typ_bloku: string | null;
  poznamka: string | null;
  active_attendance_id: string | null;
};

export type DochazkaZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  misto: string | null;
  logistika_stav: string | null;
  zrusena: boolean;
};

export type DochazkaZakazkaGroup = {
  zakazkaId: string;
  zakazka: DochazkaZakazkaRow | null;
  assignments: DochazkaAssignmentRow[];
};

export function isAcceptedAssignment(status: string | null | undefined) {
  return String(status ?? "").trim() === "accepted";
}

export const formatRange = formatAssignmentRange;
export const isLogisticsPhase = isAssignmentLogisticsPhase;
export const getLogisticsStatusLabel = getAssignmentLogisticsStatusLabel;

export function buildDochazkaGroups(
  acceptedAssignments: DochazkaAssignmentRow[],
  zakazkyById: Map<string, DochazkaZakazkaRow>
): DochazkaZakazkaGroup[] {
  const zakazkaIds = [
    ...new Set(acceptedAssignments.map((row) => row.zakazka_id).filter(Boolean)),
  ];

  return zakazkaIds
    .map((zakazkaId) => {
      const zakazka = zakazkyById.get(zakazkaId) ?? null;
      if (zakazka?.zrusena) return null;

      const assignments = acceptedAssignments
        .filter(
          (row) => row.zakazka_id === zakazkaId && !isPrepravaTypBloku(row.typ_bloku)
        )
        .sort(
          (a, b) =>
            getAssignmentPhaseSortIndex(a.typ_bloku) - getAssignmentPhaseSortIndex(b.typ_bloku)
        );

      return { zakazkaId, zakazka, assignments };
    })
    .filter((group): group is DochazkaZakazkaGroup => group !== null)
    .sort((a, b) => getZakazkaTitle(a.zakazka).localeCompare(getZakazkaTitle(b.zakazka), "cs"));
}

export function getZakazkaTitle(zakazka?: DochazkaZakazkaRow | null) {
  if (!zakazka) return "Zakázka";
  return [zakazka.cislo_zakazky, zakazka.nazev].filter(Boolean).join(" · ") || "Zakázka";
}

export function sortGroupsWithHighlight(
  groups: DochazkaZakazkaGroup[],
  highlightZakazkaId: string | null
) {
  if (!highlightZakazkaId) return groups;
  const index = groups.findIndex((group) => group.zakazkaId === highlightZakazkaId);
  if (index <= 0) return groups;
  const next = [...groups];
  const [hit] = next.splice(index, 1);
  next.unshift(hit);
  return next;
}
