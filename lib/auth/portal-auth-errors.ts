import type { AuthError } from "@supabase/supabase-js";

export function isEmailProviderDisabledError(
  error: AuthError | null | undefined
): boolean {
  if (!error) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    error.code === "email_provider_disabled" ||
    message.includes("email logins are disabled") ||
    message.includes("email provider is disabled")
  );
}

export function mapPortalSignInErrorCode(
  error: AuthError
): "email_provider_disabled" | "invalid_credentials" {
  if (isEmailProviderDisabledError(error)) {
    return "email_provider_disabled";
  }

  return "invalid_credentials";
}
