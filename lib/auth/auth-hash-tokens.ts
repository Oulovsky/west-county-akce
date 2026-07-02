export type AuthHashTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  errorCode: string | null;
  errorDescription: string | null;
};

/** Rozparsuje Supabase auth tokeny z URL hash fragmentu (#access_token=...). */
export function parseAuthHashTokens(hash: string | null | undefined): AuthHashTokens {
  const raw = (hash ?? "").replace(/^#/, "").trim();
  const params = new URLSearchParams(raw);

  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
    errorCode: params.get("error_code") ?? params.get("error"),
    errorDescription: params.get("error_description"),
  };
}

export type EmailConfirmationHashKind = "tokens" | "error" | "none";

/** Rozliší, zda hash obsahuje platné tokeny, chybu, nebo nic (běžná čekací stránka). */
export function classifyEmailConfirmationHash(
  tokens: AuthHashTokens
): EmailConfirmationHashKind {
  if (tokens.errorCode || tokens.errorDescription) {
    return "error";
  }
  if (tokens.accessToken && tokens.refreshToken) {
    return "tokens";
  }
  return "none";
}
