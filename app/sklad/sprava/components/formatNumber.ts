export function formatNumber(
  value: number | null | undefined
): string {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "-";
  }

  return new Intl.NumberFormat("cs-CZ").format(parsed);
}
