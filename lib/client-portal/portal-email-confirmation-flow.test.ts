import { describe, expect, it } from "vitest";
import {
  mapSendResendResultToConfirmation,
  planResendConfirmation,
  resendResultToRedirectStatus,
  resolveConfirmationLinkType,
} from "@/lib/client-portal/portal-email-confirmation-flow";

describe("resolveConfirmationLinkType", () => {
  it("registrace s heslem → signup", () => {
    expect(resolveConfirmationLinkType(true)).toBe("signup");
  });

  it("resend bez hesla → magiclink", () => {
    expect(resolveConfirmationLinkType(false)).toBe("magiclink");
  });
});

describe("mapSendResendResultToConfirmation", () => {
  it("Resend odeslal → ok (úspěch jen při reálném odeslání)", () => {
    expect(mapSendResendResultToConfirmation({ ok: true, sent: true })).toEqual({
      ok: true,
    });
  });

  it("chybí Resend API klíč → missing_resend_key", () => {
    expect(
      mapSendResendResultToConfirmation({
        ok: true,
        sent: false,
        skipped: true,
        skipReason: "missing_api_key",
      })
    ).toEqual({ ok: false, code: "missing_resend_key" });
  });

  it("chybí FROM → missing_from", () => {
    expect(
      mapSendResendResultToConfirmation({
        ok: true,
        sent: false,
        skipped: true,
        skipReason: "missing_from",
      })
    ).toEqual({ ok: false, code: "missing_from" });
  });

  it("chybí příjemce → send_failed", () => {
    expect(
      mapSendResendResultToConfirmation({
        ok: true,
        sent: false,
        skipped: true,
        skipReason: "missing_recipient",
      })
    ).toEqual({ ok: false, code: "send_failed" });
  });

  it("chyba Resend API → send_failed", () => {
    expect(
      mapSendResendResultToConfirmation({ ok: false, sent: false, error: "boom" })
    ).toEqual({ ok: false, code: "send_failed" });
  });
});

describe("planResendConfirmation", () => {
  it("neexistující uživatel → user_not_found", () => {
    expect(
      planResendConfirmation({
        userExists: false,
        emailConfirmed: false,
        secondsUntilResend: 0,
      })
    ).toEqual({ ok: false, code: "user_not_found" });
  });

  it("už potvrzený e-mail → already_confirmed", () => {
    expect(
      planResendConfirmation({
        userExists: true,
        emailConfirmed: true,
        secondsUntilResend: 0,
      })
    ).toEqual({ ok: false, code: "already_confirmed" });
  });

  it("cooldown aktivní → cooldown + waitSeconds", () => {
    expect(
      planResendConfirmation({
        userExists: true,
        emailConfirmed: false,
        secondsUntilResend: 42,
      })
    ).toEqual({ ok: false, code: "cooldown", waitSeconds: 42 });
  });

  it("neověřený uživatel bez cooldownu → ok", () => {
    expect(
      planResendConfirmation({
        userExists: true,
        emailConfirmed: false,
        secondsUntilResend: 0,
      })
    ).toEqual({ ok: true });
  });
});

describe("resendResultToRedirectStatus", () => {
  it("úspěch → status resent", () => {
    expect(resendResultToRedirectStatus({ ok: true })).toEqual({ status: "resent" });
  });

  it("selhání generateLink → error, nikdy resent", () => {
    const redirect = resendResultToRedirectStatus({
      ok: false,
      code: "generate_link_failed",
    });
    expect(redirect).toEqual({ error: "generate_link_failed" });
    expect("status" in redirect).toBe(false);
  });

  it("selhání Resend → error send_failed, nikdy resent", () => {
    const redirect = resendResultToRedirectStatus({ ok: false, code: "send_failed" });
    expect(redirect).toEqual({ error: "send_failed" });
    expect("status" in redirect).toBe(false);
  });
});
