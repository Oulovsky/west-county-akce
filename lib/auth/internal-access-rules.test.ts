import { describe, expect, it } from "vitest";
import {
  describeClientAuthDiagnostics,
  isClientOnlyOrphanProfile,
  isEmployeeLoginAllowed,
  isProvisionedInternalProfile,
  shouldShowInAdminEmployeeList,
} from "@/lib/auth/internal-access-rules";

describe("isProvisionedInternalProfile", () => {
  it("admin je vždy provisioned", () => {
    expect(
      isProvisionedInternalProfile({ role: "admin", aktivni: true })
    ).toBe(true);
  });

  it("zamestnanec bez jména není provisioned (orphan z triggeru)", () => {
    expect(
      isProvisionedInternalProfile({ role: "zamestnanec", aktivni: true })
    ).toBe(false);
  });

  it("zamestnanec se jménem je provisioned", () => {
    expect(
      isProvisionedInternalProfile({
        role: "zamestnanec",
        aktivni: true,
        jmeno: "Dan",
        prijmeni: "Matoušek",
      })
    ).toBe(true);
  });

  it("neinterní role není provisioned", () => {
    expect(isProvisionedInternalProfile({ role: "klient", aktivni: true })).toBe(
      false
    );
  });
});

describe("isClientOnlyOrphanProfile", () => {
  it("zamestnanec bez jména + aktivní klientský účet = orphan", () => {
    expect(
      isClientOnlyOrphanProfile({ role: "zamestnanec", jmeno: null, prijmeni: null }, true)
    ).toBe(true);
  });

  it("zamestnanec bez jména bez klientského účtu = NENÍ orphan (reálný zaměstnanec)", () => {
    expect(
      isClientOnlyOrphanProfile({ role: "zamestnanec", jmeno: null, prijmeni: null }, false)
    ).toBe(false);
  });

  it("admin nikdy není orphan", () => {
    expect(
      isClientOnlyOrphanProfile({ role: "admin", jmeno: null, prijmeni: null }, true)
    ).toBe(false);
  });

  it("zamestnanec se jménem + klientský účet = NENÍ orphan", () => {
    expect(
      isClientOnlyOrphanProfile(
        { role: "zamestnanec", jmeno: "Jan", prijmeni: "Novák" },
        true
      )
    ).toBe(false);
  });
});

describe("shouldShowInAdminEmployeeList", () => {
  const clientUsers = new Set<string>(["orphan-1"]);

  it("skryje orphan profil klientského uživatele", () => {
    expect(
      shouldShowInAdminEmployeeList(
        { user_id: "orphan-1", role: "zamestnanec", jmeno: null, prijmeni: null },
        clientUsers
      )
    ).toBe(false);
  });

  it("zobrazí reálného zaměstnance", () => {
    expect(
      shouldShowInAdminEmployeeList(
        { user_id: "emp-1", role: "zamestnanec", jmeno: "Dan", prijmeni: "M" },
        clientUsers
      )
    ).toBe(true);
  });
});

describe("describeClientAuthDiagnostics", () => {
  it("čistý klientský účet bez profiles", () => {
    const diag = describeClientAuthDiagnostics({
      authUserId: "u1",
      hasClientAccount: true,
      profile: null,
      authProviders: ["email"],
    });
    expect(diag.hasProfile).toBe(false);
    expect(diag.internalAccess).toBe(false);
    expect(diag.internalAccessReason).toContain("Bez interního profilu");
  });

  it("orphan profil (zamestnanec bez jména + klientský účet) → bez přístupu, doporučit odstranění", () => {
    const diag = describeClientAuthDiagnostics({
      authUserId: "u2",
      hasClientAccount: true,
      profile: { role: "zamestnanec", aktivni: true, jmeno: null, prijmeni: null },
      authProviders: ["email"],
    });
    expect(diag.profileProvisioned).toBe(false);
    expect(diag.internalAccess).toBe(false);
    expect(diag.internalAccessReason.toLowerCase()).toContain("orphan");
  });

  it("provisioned zaměstnanec s klientským účtem + email/heslo → interní přístup blokován", () => {
    const diag = describeClientAuthDiagnostics({
      authUserId: "u3",
      hasClientAccount: true,
      profile: { role: "zamestnanec", aktivni: true, jmeno: "Jan", prijmeni: "Novák" },
      authProviders: ["email"],
    });
    expect(diag.profileProvisioned).toBe(true);
    expect(diag.internalAccess).toBe(false);
    expect(diag.internalAccessReason).toContain("blokován");
  });

  it("provisioned zaměstnanec přes Google bez klientského účtu → interní přístup povolen", () => {
    const diag = describeClientAuthDiagnostics({
      authUserId: "u4",
      hasClientAccount: false,
      profile: { role: "zamestnanec", aktivni: true, jmeno: "Jan", prijmeni: "Novák" },
      authProviders: ["google"],
    });
    expect(diag.internalAccess).toBe(true);
    expect(diag.internalAccessReason).toContain("povolen");
  });

  it("admin s pouze email/heslo bez system-admin flagu nemá interní přístup (shoduje se s isEmployeeLoginAllowed)", () => {
    const profile = { role: "admin", aktivni: true };
    const diag = describeClientAuthDiagnostics({
      authUserId: "u5",
      hasClientAccount: false,
      profile,
      authProviders: ["email"],
    });
    expect(diag.internalAccess).toBe(
      isEmployeeLoginAllowed(profile, { authProviders: ["email"] })
    );
    expect(diag.internalAccess).toBe(false);
  });

  it("admin se system-admin e-mailem má interní přístup", () => {
    const profile = { role: "admin", aktivni: true };
    const diag = describeClientAuthDiagnostics({
      authUserId: "u6",
      hasClientAccount: false,
      profile,
      authProviders: ["email"],
      isSystemAdminEmail: true,
    });
    expect(diag.internalAccess).toBe(true);
    expect(diag.internalAccessReason).toContain("povolen");
  });
});
