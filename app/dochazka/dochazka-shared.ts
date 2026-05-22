import { isPrepravaTypBloku } from "@/lib/zakazka-attendance";

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

function getPhaseSortIndex(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "sklad" || raw === "nakladka" || raw === "nakládka") return 0;
  if (raw === "stavba") return 1;
  if (raw === "bourani" || raw === "bourání") return 2;
  return 3;
}

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
        .sort((a, b) => getPhaseSortIndex(a.typ_bloku) - getPhaseSortIndex(b.typ_bloku));

      return { zakazkaId, zakazka, assignments };
    })
    .filter((group): group is DochazkaZakazkaGroup => group !== null)
    .sort((a, b) => getZakazkaTitle(a.zakazka).localeCompare(getZakazkaTitle(b.zakazka), "cs"));
}

export function getZakazkaTitle(zakazka?: DochazkaZakazkaRow | null) {
  if (!zakazka) return "Zakázka";
  return [zakazka.cislo_zakazky, zakazka.nazev].filter(Boolean).join(" · ") || "Zakázka";
}

export function formatRange(from?: string | null, to?: string | null) {
  const formatDateTime = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fromText = formatDateTime(from);
  const toText = formatDateTime(to);
  if (fromText && toText) return `${fromText} – ${toText}`;
  if (fromText) return `Od ${fromText}`;
  if (toText) return `Do ${toText}`;
  return "Čas není zadaný";
}

export function isLogisticsPhase(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "sklad" || raw === "nakladka" || raw === "nakládka" || raw === "bourani" || raw === "bourání";
}

export function getLogisticsStatusLabel(value?: string | null) {
  if (value === "zruseno") return "Zrušeno";
  if (value === "naklada_se") return "Nakládá se";
  if (value === "nalozeno") return "Naloženo";
  if (value === "vykladka") return "Probíhá vykládka";
  if (value === "vraceno") return "Vráceno";
  return "Čeká na nakládku";
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
