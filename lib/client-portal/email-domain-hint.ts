/** Varování u časté překlepu domény email.com místo email.cz (neblokuje odeslání). */
export function getEmailComTypoHint(email: string): string | null {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0) {
    return null;
  }

  const domain = trimmed.slice(atIndex + 1).toLowerCase();
  if (domain === "email.com") {
    return "Zadali jste adresu @email.com. Nemysleli jste @email.cz?";
  }

  return null;
}
