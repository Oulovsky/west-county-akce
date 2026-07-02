import { describe, expect, it } from "vitest";
import {
  CLIENT_EMAIL_NOT_VERIFIED,
  CLIENT_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS,
  CLIENT_EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  isClientEmailVerified,
  isEmailConfirmationResendAllowed,
  isEmailNotConfirmedAuthError,
  isPortalPathRequiringVerifiedEmail,
  secondsUntilEmailConfirmationResend,
  shouldTreatClientAsEmailUnverified,
} from "@/lib/auth/client-email-verification";
import { portalAuthUserCreateParams } from "@/lib/auth/client-email-verification";
import { SUBMIT_SERVER_ERROR_MESSAGES } from "@/lib/client-portal/poptavka-wizard-validation";

describe("isClientEmailVerified", () => {
  it("vrací false bez email_confirmed_at", () => {
    expect(isClientEmailVerified({ email: "a@b.cz", email_confirmed_at: undefined })).toBe(
      false
    );
  });

  it("vrací true s email_confirmed_at", () => {
    expect(
      isClientEmailVerified({
        email: "a@b.cz",
        email_confirmed_at: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(true);
  });
});

describe("shouldTreatClientAsEmailUnverified", () => {
  const activeAccount = { stav: "active", klient_id: "klient-1" };

  it("aktivní účet bez potvrzení je neověřený", () => {
    expect(
      shouldTreatClientAsEmailUnverified(activeAccount, {
        email: "klient@firma.cz",
        email_confirmed_at: undefined,
      })
    ).toBe(true);
  });

  it("ověřený klient projde", () => {
    expect(
      shouldTreatClientAsEmailUnverified(activeAccount, {
        email: "klient@firma.cz",
        email_confirmed_at: "2026-06-01T10:00:00.000Z",
      })
    ).toBe(false);
  });

  it("bez aktivního účtu není neověřený klient portálu", () => {
    expect(
      shouldTreatClientAsEmailUnverified(
        { stav: "pending", klient_id: null },
        { email: "klient@firma.cz", email_confirmed_at: undefined }
      )
    ).toBe(false);
  });
});

describe("isEmailNotConfirmedAuthError", () => {
  it("rozpozná email_not_confirmed", () => {
    expect(
      isEmailNotConfirmedAuthError({
        code: "email_not_confirmed",
        message: "Email not confirmed",
      })
    ).toBe(true);
  });
});

describe("isEmailConfirmationResendAllowed", () => {
  it("povolí první odeslání", () => {
    expect(isEmailConfirmationResendAllowed(null)).toBe(true);
  });

  it("blokuje resend v cooldown okně", () => {
    const now = Date.now();
    const lastSent = new Date(now - 10_000).toISOString();
    expect(isEmailConfirmationResendAllowed(lastSent, now)).toBe(false);
    expect(secondsUntilEmailConfirmationResend(lastSent, now)).toBeGreaterThan(0);
  });

  it("povolí resend po cooldownu", () => {
    const now = Date.now();
    const lastSent = new Date(now - CLIENT_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS - 1).toISOString();
    expect(isEmailConfirmationResendAllowed(lastSent, now)).toBe(true);
    expect(secondsUntilEmailConfirmationResend(lastSent, now)).toBe(0);
  });
});

describe("isPortalPathRequiringVerifiedEmail", () => {
  it("chrání hlavní sekce portálu", () => {
    expect(isPortalPathRequiringVerifiedEmail("/portal/poptavka/nova")).toBe(true);
    expect(isPortalPathRequiringVerifiedEmail("/portal/poptavky")).toBe(true);
    expect(isPortalPathRequiringVerifiedEmail("/portal/zakazky/abc")).toBe(true);
    expect(isPortalPathRequiringVerifiedEmail("/portal/presety")).toBe(true);
  });

  it("nepožaduje ověření na stránce potvrzení", () => {
    expect(isPortalPathRequiringVerifiedEmail("/portal/potvrzeni-emailu")).toBe(false);
  });
});

describe("portalAuthUserCreateParams", () => {
  it("registrace vytvoří neověřený auth účet", () => {
    expect(portalAuthUserCreateParams("klient@firma.cz", "heslo1234")).toEqual({
      email: "klient@firma.cz",
      password: "heslo1234",
      email_confirm: false,
    });
  });
});

describe("submit blokace bez ověření", () => {
  it("má stabilní chybovou hlášku pro submit", () => {
    expect(SUBMIT_SERVER_ERROR_MESSAGES.email_not_verified).toBe(
      CLIENT_EMAIL_VERIFICATION_REQUIRED_MESSAGE
    );
  });

  it("používá konstantu CLIENT_EMAIL_NOT_VERIFIED v access guardu", () => {
    expect(CLIENT_EMAIL_NOT_VERIFIED).toBe("CLIENT_EMAIL_NOT_VERIFIED");
  });
});
