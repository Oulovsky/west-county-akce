export type UserRole = "admin" | "sef" | "skladnik" | "zamestnanec"

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

  adminSekce: boolean

  whitelistCteni: boolean
  whitelistEdit: boolean

  uzivateleCteni: boolean
  uzivateleEdit: boolean

  roleEdit: boolean
}

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

    adminSekce: true,

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

    adminSekce: false,

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

    adminSekce: false,

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

    adminSekce: false,

    whitelistCteni: false,
    whitelistEdit: false,

    uzivateleCteni: false,
    uzivateleEdit: false,

    roleEdit: false,
  },
}

export function getRolePermissions(role: string | null | undefined): RolePermissions {
  if (role === "admin") return ROLE_PERMISSIONS.admin
  if (role === "sef") return ROLE_PERMISSIONS.sef
  if (role === "skladnik") return ROLE_PERMISSIONS.skladnik
  return ROLE_PERMISSIONS.zamestnanec
}