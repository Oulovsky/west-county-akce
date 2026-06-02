/** Next.js `redirect()` / `notFound()` vyhodí speciální chybu — nesmí se chytat jako aplikační error. */
export function isNextRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const digest =
    "digest" in error && typeof (error as { digest: unknown }).digest === "string"
      ? (error as { digest: string }).digest
      : "";

  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
    return true;
  }

  return error instanceof Error && error.message === "NEXT_REDIRECT";
}

export function rethrowIfNextRedirect(error: unknown): void {
  if (isNextRedirectError(error)) {
    throw error;
  }
}
