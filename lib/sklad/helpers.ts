import type { CSSProperties } from "react";
import {
  SKLAD_EMPTY_LABEL,
  SKLAD_KUS_STATUS_CLASS,
  SKLAD_PRIORITA_BADGE_CLASS,
} from "@/lib/sklad/constants";
import type {
  SkladKusRow,
  SkladPoskozeniListRow,
  SkladPoskozeniRow,
  SkladZakazkaOption,
} from "@/lib/sklad/types";

export type SkladKusStatus = {
  text: string;
  className: string;
  blokovano: 0 | 1;
  pouzitelne: string;
};

export function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNumber(value: number | string | null | undefined): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return SKLAD_EMPTY_LABEL;
  return new Intl.NumberFormat("cs-CZ").format(parsed);
}

export function formatMoney(value: number | string | null | undefined): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return SKLAD_EMPTY_LABEL;

  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed);
}

export function formatDateTime(
  value: string | null | undefined,
  emptyLabel: string = SKLAD_EMPTY_LABEL
): string {
  if (!value) return emptyLabel;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function slugifyCz(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function prioritaBadgeClassName(priorita: string | null | undefined): string {
  const s = slugifyCz(priorita);

  if (s.includes("krit")) return SKLAD_PRIORITA_BADGE_CLASS.kriticka;
  if (s.includes("vys")) return SKLAD_PRIORITA_BADGE_CLASS.vysoka;
  if (s.includes("stred")) return SKLAD_PRIORITA_BADGE_CLASS.stredni;
  if (s.includes("niz")) return SKLAD_PRIORITA_BADGE_CLASS.nizka;

  return SKLAD_PRIORITA_BADGE_CLASS.default;
}

export function formatPrioritaLabel(value: string | null | undefined): string {
  const normalized = slugifyCz(value);

  switch (normalized) {
    case "nizka":
      return "nízká";
    case "stredni":
      return "střední";
    case "vysoka":
      return "vysoká";
    case "kriticka":
      return "kritická";
    default:
      return value?.trim() || "bez priority";
  }
}

/** Badge třídy pro evidenci poškození (včetně text-*). */
export function prioritaEvidenceBadgeClassName(
  priorita: string | null | undefined
): string {
  const normalized = slugifyCz(priorita);

  switch (normalized) {
    case "kriticka":
      return "bg-red-600 text-white";
    case "vysoka":
      return "bg-orange-500 text-white";
    case "stredni":
      return "bg-yellow-400 text-slate-950";
    case "nizka":
      return "bg-slate-500 text-white";
    default:
      return "bg-slate-600 text-white";
  }
}

export function isPoskozeniClosed(
  item: Pick<SkladPoskozeniRow, "datum_uzavreni" | "stav_reseni">
): boolean {
  const stavReseni = slugifyCz(item.stav_reseni ?? "");

  return (
    Boolean(item.datum_uzavreni) ||
    ["uzavreno", "uzavrene", "vyreseno", "closed"].includes(stavReseni)
  );
}

export function getEvidencePoskozeniKusLabel(
  item: Pick<SkladPoskozeniRow, "kus_id">,
  kusyById: Record<string, Pick<SkladKusRow, "kus_id" | "poradove_cislo" | "evidencni_cislo">>
): string {
  if (!item.kus_id) return "bez konkrétního kusu";

  const kus = kusyById[item.kus_id];

  if (!kus) return `Kus ${item.kus_id}`;

  return kus.evidencni_cislo?.trim()
    ? kus.evidencni_cislo
    : `Kus #${kus.poradove_cislo}`;
}

export function buildZakazkaLabel(
  zakazka: Pick<SkladZakazkaOption, "cislo_zakazky" | "nazev">
): string {
  const cislo = zakazka.cislo_zakazky || "Bez čísla";
  const nazev = zakazka.nazev || "Zakázka";
  return `${cislo} — ${nazev}`;
}

export function formatTypPoskozeniLabel(value: string | null | undefined): string {
  const normalized = slugifyCz(value);

  switch (normalized) {
    case "mechanicke":
      return "mechanické";
    case "elektricke":
      return "elektrické";
    case "vizualni":
      return "vizuální";
    case "jine":
      return "jiné";
    default:
      return value?.trim() || "bez typu";
  }
}

export function badgeStyle(background: string): CSSProperties {
  return {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    background,
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.2,
  };
}

export function getKusLabel(kus: SkladKusRow): string {
  return kus.evidencni_cislo?.trim()
    ? kus.evidencni_cislo
    : `Kus #${kus.poradove_cislo}`;
}

export function getPoskozeniListKusLabel(
  row: Pick<SkladPoskozeniListRow, "kus_id" | "nazev">,
  kusyById: Record<string, Pick<SkladKusRow, "evidencni_cislo" | "poradove_cislo">>
): string {
  if (!row.kus_id) return row.nazev;

  const kus = kusyById[row.kus_id];
  if (!kus) return row.nazev;

  return kus.evidencni_cislo?.trim()
    ? kus.evidencni_cislo
    : `${row.nazev} #${kus.poradove_cislo}`;
}

export function getKusStatus(
  kus: SkladKusRow,
  poskozeni: SkladPoskozeniRow[]
): SkladKusStatus {
  const otevrene = poskozeni.filter(
    (p) => p.kus_id === kus.kus_id && !p.datum_uzavreni
  );

  const blokuje = otevrene.some((p) => p.blokuje_pouziti);

  if (blokuje) {
    return {
      text: "blokováno",
      className: SKLAD_KUS_STATUS_CLASS.blokovano,
      blokovano: 1,
      pouzitelne: "✕",
    };
  }

  if (otevrene.length > 0) {
    return {
      text: "poškozeno, použitelné",
      className: SKLAD_KUS_STATUS_CLASS.poskozenoPouzitelne,
      blokovano: 0,
      pouzitelne: "!",
    };
  }

  return {
    text: "OK",
    className: SKLAD_KUS_STATUS_CLASS.ok,
    blokovano: 0,
    pouzitelne: "✓",
  };
}

export function computeCelkemKusu(
  evidovanyPocetKusu: number,
  fallbackCelkem: number | string | null | undefined
): number {
  return evidovanyPocetKusu > 0 ? evidovanyPocetKusu : toNumber(fallbackCelkem);
}

export function sumBlokujiciPoskozeneKusy(poskozeni: SkladPoskozeniRow[]): number {
  return poskozeni
    .filter((p) => !p.datum_uzavreni && p.blokuje_pouziti)
    .reduce((sum, item) => sum + toNumber(item.pocet_kusu), 0);
}

export function computePouzitelneKusy(
  celkemKusu: number,
  poskozeneKusy: number
): number {
  return Math.max(0, celkemKusu - poskozeneKusy);
}
