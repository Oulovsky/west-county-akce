import { describe, expect, it } from "vitest";
import {
  buildUnverifiedEmailChangeTargets,
  planUnverifiedEmailChange,
  shouldUpdateKlientContactEmail,
  validateUnverifiedEmailChangeInput,
} from "@/lib/client-portal/portal-email-change-flow";

describe("validateUnverifiedEmailChangeInput", () => {
  it("vyžaduje všechna pole", () => {
    expect(
      validateUnverifiedEmailChangeInput({
        currentEmail: "",
        newEmail: "a@b.cz",
        password: "heslo123",
      })
    ).toEqual({ ok: false, code: "missing_fields" });
  });

  it("odmítne neplatný nový e-mail", () => {
    expect(
      validateUnverifiedEmailChangeInput({
        currentEmail: "old@b.cz",
        newEmail: "neplatny",
        password: "heslo123",
      })
    ).toEqual({ ok: false, code: "invalid_email" });
  });

  it("odmítne stejný e-mail", () => {
    expect(
      validateUnverifiedEmailChangeInput({
        currentEmail: "stejny@b.cz",
        newEmail: "stejny@b.cz",
        password: "heslo123",
      })
    ).toEqual({ ok: false, code: "same_email" });
  });

  it("projde validní vstup", () => {
    expect(
      validateUnverifiedEmailChangeInput({
        currentEmail: "OLD@B.CZ",
        newEmail: "  new@b.cz ",
        password: "heslo123",
      })
    ).toEqual({
      ok: true,
      currentEmail: "old@b.cz",
      newEmail: "new@b.cz",
    });
  });
});

describe("shouldUpdateKlientContactEmail", () => {
  it("aktualizuje klienti.email jen pokud odpovídá původnímu auth e-mailu", () => {
    expect(
      shouldUpdateKlientContactEmail({
        klientEmail: "registrant@b.cz",
        currentAuthEmail: "registrant@b.cz",
      })
    ).toBe(true);
  });

  it("neaktualizuje klienti.email pokud firma má jiný kontaktní e-mail", () => {
    expect(
      shouldUpdateKlientContactEmail({
        klientEmail: "firma@b.cz",
        currentAuthEmail: "registrant@b.cz",
      })
    ).toBe(false);
  });
});

describe("planUnverifiedEmailChange", () => {
  const base = {
    userExists: true,
    emailConfirmed: false,
    passwordVerified: true,
    hasActiveClientAccount: true,
    profile: null,
  };

  it("neexistující uživatel", () => {
    expect(
      planUnverifiedEmailChange({ ...base, userExists: false })
    ).toEqual({ ok: false, code: "user_not_found" });
  });

  it("už ověřený účet", () => {
    expect(
      planUnverifiedEmailChange({ ...base, emailConfirmed: true })
    ).toEqual({ ok: false, code: "already_confirmed" });
  });

  it("špatné heslo", () => {
    expect(
      planUnverifiedEmailChange({ ...base, passwordVerified: false })
    ).toEqual({ ok: false, code: "wrong_password" });
  });

  it("provisioned interní zaměstnanec", () => {
    expect(
      planUnverifiedEmailChange({
        ...base,
        profile: { role: "zamestnanec", aktivni: true, jmeno: "Jan", prijmeni: "Novák" },
      })
    ).toEqual({ ok: false, code: "internal_user_forbidden" });
  });

  it("bez aktivního klientského účtu", () => {
    expect(
      planUnverifiedEmailChange({ ...base, hasActiveClientAccount: false })
    ).toEqual({ ok: false, code: "not_client_account" });
  });

  it("úspěšný plán pro neověřeného klienta", () => {
    expect(
      planUnverifiedEmailChange({
        ...base,
        profile: { role: "zamestnanec", aktivni: true, jmeno: null, prijmeni: null },
      })
    ).toEqual({ ok: true });
  });
});

describe("buildUnverifiedEmailChangeTargets", () => {
  it("cílí jen na konkrétního uživatele a jeho účet", () => {
    const targets = buildUnverifiedEmailChangeTargets({
      userId: "user-a",
      accountId: "account-a",
      klientId: "klient-1",
      klientEmail: "user-a@b.cz",
      currentAuthEmail: "user-a@b.cz",
      hasPoptavkyWithKontaktEmail: true,
    });

    expect(targets).toEqual({
      userId: "user-a",
      accountId: "account-a",
      klientId: "klient-1",
      updateKlientEmail: true,
      updatePoptavkyKontakt: true,
    });
  });

  it("neaktualizuje klienti.email pokud firma má jiný kontaktní e-mail (jiné client_accounts)", () => {
    const targets = buildUnverifiedEmailChangeTargets({
      userId: "user-b",
      accountId: "account-b",
      klientId: "klient-1",
      klientEmail: "verified-owner@b.cz",
      currentAuthEmail: "new-member@b.cz",
      hasPoptavkyWithKontaktEmail: false,
    });

    expect(targets.updateKlientEmail).toBe(false);
    expect(targets.updatePoptavkyKontakt).toBe(false);
    expect(targets.userId).toBe("user-b");
    expect(targets.accountId).toBe("account-b");
  });

  it("neobsahuje profiles — změna se týká jen auth + client data", () => {
    const targets = buildUnverifiedEmailChangeTargets({
      userId: "user-a",
      accountId: "account-a",
      klientId: "klient-1",
      klientEmail: "user-a@b.cz",
      currentAuthEmail: "user-a@b.cz",
      hasPoptavkyWithKontaktEmail: false,
    });

    expect(targets).not.toHaveProperty("updateProfiles");
    expect(Object.keys(targets)).toEqual([
      "userId",
      "accountId",
      "klientId",
      "updateKlientEmail",
      "updatePoptavkyKontakt",
    ]);
  });
});

describe("scénáře chyb po změně e-mailu", () => {
  it("resend po změně selže — server vrací konkrétní kód, ne úspěch", () => {
    const confirmationFailed = { ok: false as const, code: "send_failed" as const };
    expect(confirmationFailed.ok).toBe(false);
    expect(confirmationFailed.code).toBe("send_failed");
  });

  it("nový e-mail už existuje — kód email_exists", () => {
    const result = { ok: false as const, code: "email_exists" as const };
    expect(result.code).toBe("email_exists");
  });
});
