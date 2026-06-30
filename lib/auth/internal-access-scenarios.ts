import {
  isClientOnlyOrphanProfile,
  isEmployeeLoginAllowed,
  isProvisionedInternalProfile,
  shouldShowInAdminEmployeeList,
} from "@/lib/auth/internal-access-rules";

export type ScenarioResult = { name: string; ok: boolean };

function run(name: string, ok: boolean): ScenarioResult {
  return { name, ok };
}

const DAN_USER_ID = "00000000-0000-4000-8000-000000000001";
const PRCHAL_CLIENT_USER_ID = "00000000-0000-4000-8000-000000000002";

/** Scénáře pro oddělení klientského vs. interního účtu (spustitelné bez DB). */
export function runInternalAccessScenarios(): ScenarioResult[] {
  const noClientAccounts = new Set<string>();
  const prchalHasClientAccount = new Set<string>([PRCHAL_CLIENT_USER_ID]);

  const danProfile = {
    user_id: DAN_USER_ID,
    role: "zamestnanec",
    aktivni: true,
    jmeno: null,
    prijmeni: null,
  };

  const prchalOrphanProfile = {
    user_id: PRCHAL_CLIENT_USER_ID,
    role: "zamestnanec",
    aktivni: true,
    jmeno: null,
    prijmeni: null,
  };

  return [
    run(
      "danmatouseek zamestnanec without name is not client-only orphan",
      !isClientOnlyOrphanProfile(danProfile, false)
    ),
    run(
      "danmatouseek zamestnanec without name visible in admin employee list",
      shouldShowInAdminEmployeeList(danProfile, noClientAccounts)
    ),
    run(
      "prchal.jarda@email.com client-only orphan hidden from admin employee list",
      !shouldShowInAdminEmployeeList(prchalOrphanProfile, prchalHasClientAccount)
    ),
    run(
      "prchal client-only orphan is detected as orphan profile",
      isClientOnlyOrphanProfile(prchalOrphanProfile, true)
    ),
    run(
      "auto profile without name is not provisioned internal (login gate)",
      !isProvisionedInternalProfile({
        role: "zamestnanec",
        aktivni: true,
        jmeno: null,
        prijmeni: null,
      })
    ),
    run(
      "createEmployee profile is provisioned internal",
      isProvisionedInternalProfile({
        role: "zamestnanec",
        aktivni: true,
        jmeno: "Jaroslav",
        prijmeni: "Prchal",
      })
    ),
    run(
      "client-only email user cannot access internal app",
      !isEmployeeLoginAllowed(
        { role: "zamestnanec", aktivni: true, jmeno: null, prijmeni: null },
        { hasActiveClientAccount: true, authProviders: ["email"] }
      )
    ),
    run(
      "provisioned internal google user can access internal app",
      isEmployeeLoginAllowed(
        { role: "sef", aktivni: true, jmeno: "Jaroslav", prijmeni: "Prchal" },
        { hasActiveClientAccount: false, authProviders: ["google"] }
      )
    ),
    run(
      "admin role without name still counts as provisioned",
      isProvisionedInternalProfile({
        role: "admin",
        aktivni: true,
        jmeno: null,
        prijmeni: null,
      })
    ),
  ];
}

export function assertInternalAccessScenarios(): void {
  const results = runInternalAccessScenarios();
  const failed = results.filter((row) => !row.ok);
  if (failed.length > 0) {
    throw new Error(
      `Internal access scenarios failed: ${failed.map((row) => row.name).join(", ")}`
    );
  }
}
