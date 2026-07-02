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

export type ClientAuthDiagnostics = {
  authUserId: string | null;
  hasClientAccount: boolean;
  hasProfile: boolean;
  profileRole: string | null;
  profileAktivni: boolean | null;
  profileProvisioned: boolean;
  internalAccess: boolean;
  internalAccessReason: string;
};

/**
 * Diagnostika oddělení klient vs. interní zaměstnanec pro admin detail.
 * Čistá funkce nad načtenými daty (bez DB), aby šla testovat.
 */
export function describeClientAuthDiagnostics(input: {
  authUserId: string | null;
  hasClientAccount: boolean;
  profile: InternalProfileForAccess | null;
  authProviders?: string[];
  isSystemAdminEmail?: boolean;
}): ClientAuthDiagnostics {
  const { authUserId, hasClientAccount, profile } = input;
  const authProviders = input.authProviders ?? [];

  const base = {
    authUserId,
    hasClientAccount,
    hasProfile: Boolean(profile),
    profileRole: profile?.role ?? null,
    profileAktivni: profile?.aktivni ?? null,
    profileProvisioned: isProvisionedInternalProfile(profile),
  };

  if (!profile) {
    return {
      ...base,
      internalAccess: false,
      internalAccessReason: "Bez interního profilu — čistý klientský účet.",
    };
  }

  if (!isExplicitInternalRole(profile.role)) {
    return {
      ...base,
      internalAccess: false,
      internalAccessReason: `Profil bez interní role (role „${profile.role}").`,
    };
  }

  if (isClientOnlyOrphanProfile(profile, hasClientAccount)) {
    return {
      ...base,
      internalAccess: false,
      internalAccessReason:
        "Orphan profil (interní role bez provisioningu u klientského účtu) — nemá interní přístup a měl by být odstraněn.",
    };
  }

  if (!isProvisionedInternalProfile(profile)) {
    return {
      ...base,
      internalAccess: false,
      internalAccessReason: "Interní role bez provisioningu (chybí jméno) — nemá interní přístup.",
    };
  }

  const internalAccess = isEmployeeLoginAllowed(profile, {
    isSystemAdminEmail: input.isSystemAdminEmail,
    authProviders,
    hasActiveClientAccount: hasClientAccount,
  });

  if (internalAccess) {
    return {
      ...base,
      internalAccess: true,
      internalAccessReason: "Interní přístup povolen (provisioned interní profil).",
    };
  }

  if (hasClientAccount && usesEmailPasswordOnly(authProviders)) {
    return {
      ...base,
      internalAccess: false,
      internalAccessReason:
        "Interní role, ale přihlášení e-mailem/heslem + aktivní klientský účet → interní přístup blokován.",
    };
  }

  return {
    ...base,
    internalAccess: false,
    internalAccessReason: "Interní přístup zamítnut.",
  };
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
