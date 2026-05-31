export type UserRole = "admin" | "sef" | "skladnik" | "zamestnanec" | "hdt";

export const USER_ROLES: readonly UserRole[] = [
  "admin",
  "sef",
  "skladnik",
  "zamestnanec",
  "hdt",
] as const;

export type RolePermissions = {
  administraceAplikace: boolean

  zakazkyCteni: boolean
  zakazkyEditace: boolean

  technikaCteni: boolean
  technikaEditace: boolean

  nakladkaCteni: boolean
  nakladkaEditace: boolean

  historieCteni: boolean
  exporty: boolean

  skladCteni: boolean
  skladEditace: boolean

  financniUdajeCteni: boolean
  ucetniKonfiguraceCteni: boolean

  adminSekce: boolean
  systemovaNastaveni: boolean

  whitelistCteni: boolean
  whitelistEdit: boolean

  uzivateleCteni: boolean
  uzivateleEdit: boolean

  roleEdit: boolean
};

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    administraceAplikace: true,

    zakazkyCteni: true,
    zakazkyEditace: true,

    technikaCteni: true,
    technikaEditace: true,

    nakladkaCteni: true,
    nakladkaEditace: true,

    historieCteni: true,
    exporty: true,

    skladCteni: true,
    skladEditace: true,

    financniUdajeCteni: true,
    ucetniKonfiguraceCteni: true,

    adminSekce: true,
    systemovaNastaveni: true,

    whitelistCteni: true,
    whitelistEdit: true,

    uzivateleCteni: true,
    uzivateleEdit: true,

    roleEdit: true,
  },

  sef: {
    administraceAplikace: false,

    zakazkyCteni: true,
    zakazkyEditace: true,

    technikaCteni: true,
    technikaEditace: true,

    nakladkaCteni: true,
    nakladkaEditace: true,

    historieCteni: true,
    exporty: true,

    skladCteni: true,
    skladEditace: true,

    financniUdajeCteni: true,
    ucetniKonfiguraceCteni: false,

    adminSekce: false,
    systemovaNastaveni: false,

    whitelistCteni: false,
    whitelistEdit: false,

    uzivateleCteni: false,
    uzivateleEdit: false,

    roleEdit: false,
  },

  skladnik: {
    administraceAplikace: false,

    zakazkyCteni: true,
    zakazkyEditace: true,

    technikaCteni: true,
    technikaEditace: true,

    nakladkaCteni: true,
    nakladkaEditace: true,

    historieCteni: true,
    exporty: true,

    skladCteni: true,
    skladEditace: true,

    financniUdajeCteni: false,
    ucetniKonfiguraceCteni: false,

    adminSekce: false,
    systemovaNastaveni: false,

    whitelistCteni: false,
    whitelistEdit: false,

    uzivateleCteni: false,
    uzivateleEdit: false,

    roleEdit: false,
  },

  zamestnanec: {
    administraceAplikace: false,

    zakazkyCteni: true,
    zakazkyEditace: false,

    technikaCteni: true,
    technikaEditace: false,

    nakladkaCteni: true,
    nakladkaEditace: false,

    historieCteni: true,
    exporty: false,

    skladCteni: true,
    skladEditace: false,

    financniUdajeCteni: false,
    ucetniKonfiguraceCteni: false,

    adminSekce: false,
    systemovaNastaveni: false,

    whitelistCteni: false,
    whitelistEdit: false,

    uzivateleCteni: false,
    uzivateleEdit: false,

    roleEdit: false,
  },

  hdt: {
    administraceAplikace: false,

    zakazkyCteni: true,
    zakazkyEditace: false,

    technikaCteni: true,
    technikaEditace: false,

    nakladkaCteni: false,
    nakladkaEditace: false,

    historieCteni: true,
    exporty: true,

    skladCteni: true,
    skladEditace: false,

    financniUdajeCteni: true,
    ucetniKonfiguraceCteni: true,

    adminSekce: false,
    systemovaNastaveni: false,

    whitelistCteni: false,
    whitelistEdit: false,

    uzivateleCteni: false,
    uzivateleEdit: false,

    roleEdit: false,
  },
};

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

/** Interní role bez oprávnění měnit data (HDT). */
export function isReadOnlyInternalRole(role: string | null | undefined): boolean {
  return role === "hdt";
}

export function rolePermissionsAllowWrite(perms: RolePermissions): boolean {
  return (
    perms.zakazkyEditace ||
    perms.technikaEditace ||
    perms.nakladkaEditace ||
    perms.skladEditace ||
    perms.adminSekce ||
    perms.systemovaNastaveni ||
    perms.whitelistEdit ||
    perms.uzivateleEdit ||
    perms.roleEdit ||
    perms.administraceAplikace
  );
}

export function getRolePermissions(role: string | null | undefined): RolePermissions {
  if (role === "admin") return ROLE_PERMISSIONS.admin;
  if (role === "sef") return ROLE_PERMISSIONS.sef;
  if (role === "skladnik") return ROLE_PERMISSIONS.skladnik;
  if (role === "hdt") return ROLE_PERMISSIONS.hdt;
  if (role === "zamestnanec") return ROLE_PERMISSIONS.zamestnanec;
  return ROLE_PERMISSIONS.zamestnanec;
}
