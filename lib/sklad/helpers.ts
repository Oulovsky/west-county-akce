import type { SkladKusRow, SkladPoskozeniRow } from "@/lib/sklad/types";

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
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.NumberFormat("cs-CZ").format(parsed);
}

export function formatMoney(value: number | string | null | undefined): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";

  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

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

export function slugifyCz(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getKusLabel(kus: SkladKusRow): string {
  return kus.evidencni_cislo?.trim()
    ? kus.evidencni_cislo
    : `Kus #${kus.poradove_cislo}`;
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
      className: "border-red-700 bg-red-950 text-red-200",
      blokovano: 1,
      pouzitelne: "✕",
    };
  }

  if (otevrene.length > 0) {
    return {
      text: "poškozeno, použitelné",
      className: "border-amber-700 bg-amber-950 text-amber-200",
      blokovano: 0,
      pouzitelne: "!",
    };
  }

  return {
    text: "OK",
    className: "border-emerald-700 bg-emerald-950 text-emerald-200",
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
