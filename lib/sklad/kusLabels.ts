export type SkladKusLabelPayload = {
  kusId: string;
  itemName: string;
  poradoveCislo: number | string;
  position: number | string | null | undefined;
  sector?: string | null | undefined;
};

export function getSkladKusFuturePath(kusId: string): string {
  return `/sklad/kus/${encodeURIComponent(kusId)}`;
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function getSkladKusQrPayload(
  kusId: string,
  fallbackOrigin: string
): string {
  const configuredBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  const fallbackBaseUrl = normalizeBaseUrl(fallbackOrigin);
  const baseUrl = configuredBaseUrl ?? fallbackBaseUrl ?? "";

  return `${baseUrl}${getSkladKusFuturePath(kusId)}`;
}

export function extractSkladKusIdFromInput(
  input: string,
  baseUrl: string = "http://localhost"
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed, baseUrl);
    const match = url.pathname.match(/^\/sklad\/kus\/([^/?#]+)\/?$/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    // Pokud to není URL, níže zkusíme vstup jako přímé kus_id.
  }

  if (/^[^\s/?#]+$/.test(trimmed)) return trimmed;
  return null;
}
