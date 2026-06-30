import { isUserRole, type UserRole } from "@/lib/roles";

export type InternalProfileForAccess = {
  role: string;
  aktivni: boolean | null;
  jmeno?: string | null;
  prijmeni?: string | null;
};

/** Role, které v systému skutečně existují a patří interní aplikaci. */
export function isExplicitInternalRole(role: string | null | undefined): role is UserRole {
  if (!role?.trim()) return false;
  return isUserRole(role.trim().toLowerCase());
}

/**
 * Interní profil založený adminem (createEmployee) — ne automatický Supabase trigger
 * s default role=zamestnanec bez jména.
 */
export function isProvisionedInternalProfile(
  profile: InternalProfileForAccess | null | undefined
): boolean {
  if (!profile || !isExplicitInternalRole(profile.role)) {
    return false;
  }

  if (profile.role === "admin") {
    return true;
  }

  return Boolean(profile.jmeno?.trim() || profile.prijmeni?.trim());
}

/**
 * Orphan profil z auth triggeru: interní role bez jména u uživatele s aktivním klientským účtem.
 * Skutečný zaměstnanec (např. bez vyplněného jména) nemá aktivní client_accounts → není orphan.
 */
export function isClientOnlyOrphanProfile(
  profile: Pick<InternalProfileForAccess, "role" | "jmeno" | "prijmeni">,
  hasActiveClientAccount: boolean
): boolean {
  if (!hasActiveClientAccount || !isExplicitInternalRole(profile.role)) {
    return false;
  }

  if (profile.role === "admin") {
    return false;
  }

  return !Boolean(profile.jmeno?.trim() || profile.prijmeni?.trim());
}

/** Seznam zaměstnanců v /admin — skrýt jen client-only orphan profily, ne reálné interní role. */
export function shouldShowInAdminEmployeeList(
  profile: Pick<InternalProfileForAccess, "role" | "jmeno" | "prijmeni"> & {
    user_id: string;
  },
  activeClientUserIds: ReadonlySet<string>
): boolean {
  if (!isExplicitInternalRole(profile.role)) {
    return false;
  }

  return !isClientOnlyOrphanProfile(
    profile,
    activeClientUserIds.has(profile.user_id)
  );
}

export function getAuthProvidersFromUser(user: {
  app_metadata?: Record<string, unknown> | null;
  identities?: Array<{ provider?: string | null }> | null;
}): string[] {
  const fromIdentities = (user.identities ?? [])
    .map((identity) => identity.provider?.trim().toLowerCase())
    .filter((provider): provider is string => Boolean(provider));

  if (fromIdentities.length > 0) {
    return [...new Set(fromIdentities)];
  }

  const rawProviders = user.app_metadata?.providers;
  if (Array.isArray(rawProviders)) {
    return rawProviders
      .map((provider) => String(provider).trim().toLowerCase())
      .filter(Boolean);
  }

  return ["email"];
}

export function usesEmailPasswordOnly(providers: string[]): boolean {
  return !providers.includes("google");
}

export type EmployeeLoginAllowedOptions = {
  isSystemAdminEmail?: boolean;
  authProviders?: string[];
  hasActiveClientAccount?: boolean;
};

/**
 * Interní přístup: explicitní interní role + založený profil (jméno/příjmení nebo admin).
 * Pouhá existence řádku v profiles nestačí.
 */
export function isEmployeeLoginAllowed(
  profile: InternalProfileForAccess | null | undefined,
  options: EmployeeLoginAllowedOptions = {}
): boolean {
  if (!profile) {
    return false;
  }

  if (!isExplicitInternalRole(profile.role)) {
    return false;
  }

  if (profile.role !== "admin" && profile.aktivni === false) {
    return false;
  }

  if (!isProvisionedInternalProfile(profile)) {
    return false;
  }

  const providers = options.authProviders ?? [];
  const hasActiveClientAccount = options.hasActiveClientAccount === true;

  if (hasActiveClientAccount && usesEmailPasswordOnly(providers)) {
    return false;
  }

  if (options.isSystemAdminEmail) {
    return true;
  }

  if (hasActiveClientAccount && !usesEmailPasswordOnly(providers)) {
    return true;
  }

  if (usesEmailPasswordOnly(providers)) {
    return false;
  }

  return true;
}
