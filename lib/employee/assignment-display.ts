import { isPrepravaTypBloku } from "@/lib/zakazka-attendance";

/** Popisek fáze v přehledu zaměstnance (/moje) — „Provoz akce“ místo „Provoz“. */
export function getAssignmentPhaseLabel(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "sklad" || raw === "nakladka" || raw === "nakládka") return "Nakládka";
  if (raw === "stavba") return "Stavba";
  if (raw === "bourani" || raw === "bourání") return "Bourání";
  if (raw === "preprava" || raw === "prejezd" || raw === "přejezd") return "Přeprava";
  return "Provoz akce";
}

export function getAssignmentPhaseSortIndex(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "sklad" || raw === "nakladka" || raw === "nakládka") return 0;
  if (raw === "stavba") return 1;
  if (raw === "bourani" || raw === "bourání") return 3;
  return 2;
}

export function getAssignmentPhaseAccentClass(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "sklad" || raw === "nakladka" || raw === "nakládka") {
    return "border-cyan-400/70 bg-cyan-500/15 text-cyan-50";
  }
  if (raw === "stavba") return "border-amber-400/70 bg-amber-500/15 text-amber-50";
  if (raw === "bourani" || raw === "bourání") {
    return "border-orange-400/70 bg-orange-500/15 text-orange-50";
  }
  return "border-blue-400/70 bg-blue-500/15 text-blue-50";
}

export function isAssignmentLogisticsPhase(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  return (
    raw === "sklad" ||
    raw === "nakladka" ||
    raw === "nakládka" ||
    raw === "bourani" ||
    raw === "bourání"
  );
}

export function getAssignmentLogisticsStatusLabel(value?: string | null) {
  if (value === "zruseno") return "Zrušeno";
  if (value === "naklada_se") return "Nakládá se";
  if (value === "nalozeno") return "Naloženo";
  if (value === "vykladka") return "Probíhá vykládka";
  if (value === "vraceno") return "Vráceno";
  return "Čeká na nakládku";
}

export function formatAssignmentDateTime(value?: string | null) {
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
}

export function formatAssignmentRange(from?: string | null, to?: string | null) {
  const fromText = formatAssignmentDateTime(from);
  const toText = formatAssignmentDateTime(to);

  if (fromText && toText) return `${fromText} – ${toText}`;
  if (fromText) return `Od ${fromText}`;
  if (toText) return `Do ${toText}`;
  return "Čas není zadaný";
}

export function groupAssignmentsByZakazka<
  T extends { assignment: { zakazka_id: string; typ_bloku: string | null } },
  Z
>(items: T[], getZakazka: (item: T) => Z | null) {
  const workItems = items.filter((item) => !isPrepravaTypBloku(item.assignment.typ_bloku));
  const groups = new Map<string, T[]>();

  for (const item of workItems) {
    const zakazkaId = item.assignment.zakazka_id;
    const list = groups.get(zakazkaId) ?? [];
    list.push(item);
    groups.set(zakazkaId, list);
  }

  return [...groups.entries()].map(([zakazkaId, groupItems]) => ({
    zakazkaId,
    zakazka: getZakazka(groupItems[0]) ?? null,
    items: [...groupItems].sort(
      (a, b) =>
        getAssignmentPhaseSortIndex(a.assignment.typ_bloku) -
        getAssignmentPhaseSortIndex(b.assignment.typ_bloku)
    ),
  }));
}
