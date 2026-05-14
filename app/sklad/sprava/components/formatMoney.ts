export function formatMoney(
  value: number | null | undefined
): string {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "-";
  }

  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed);
}
