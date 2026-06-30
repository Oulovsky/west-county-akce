import {
  isEmployeeLoginAllowed,
  isProvisionedInternalProfile,
} from "@/lib/auth/internal-access-rules";

export type ScenarioResult = { name: string; ok: boolean };

function run(name: string, ok: boolean): ScenarioResult {
  return { name, ok };
}

/** Scénáře pro oddělení klientského vs. interního účtu (spustitelné bez DB). */
export function runInternalAccessScenarios(): ScenarioResult[] {
  return [
    run(
      "auto profile without name is not provisioned internal",
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
      "system admin email bypasses client-only block",
      isEmployeeLoginAllowed(
        { role: "zamestnanec", aktivni: true, jmeno: "Jaroslav", prijmeni: "Prchal" },
        {
          hasActiveClientAccount: true,
          authProviders: ["google"],
          isSystemAdminEmail: true,
        }
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
