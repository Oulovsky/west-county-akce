import { describe, expect, it } from "vitest";
import {
  classifyEmailConfirmationHash,
  parseAuthHashTokens,
} from "@/lib/auth/auth-hash-tokens";

describe("parseAuthHashTokens", () => {
  it("rozparsuje signup tokeny z hash fragmentu", () => {
    const tokens = parseAuthHashTokens(
      "#access_token=abc123&refresh_token=def456&type=signup&expires_in=3600"
    );
    expect(tokens.accessToken).toBe("abc123");
    expect(tokens.refreshToken).toBe("def456");
    expect(tokens.type).toBe("signup");
    expect(tokens.errorCode).toBeNull();
  });

  it("zvládne hash bez úvodního #", () => {
    const tokens = parseAuthHashTokens("access_token=abc&refresh_token=xyz");
    expect(tokens.accessToken).toBe("abc");
    expect(tokens.refreshToken).toBe("xyz");
  });

  it("rozpozná chybu expirovaného odkazu", () => {
    const tokens = parseAuthHashTokens(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );
    expect(tokens.errorCode).toBe("otp_expired");
    expect(tokens.errorDescription).toContain("expired");
  });

  it("prázdný hash vrátí samá null", () => {
    const tokens = parseAuthHashTokens("");
    expect(tokens.accessToken).toBeNull();
    expect(tokens.refreshToken).toBeNull();
    expect(tokens.errorCode).toBeNull();
  });

  it("undefined/null hash vrátí samá null", () => {
    expect(parseAuthHashTokens(undefined).accessToken).toBeNull();
    expect(parseAuthHashTokens(null).accessToken).toBeNull();
  });
});

describe("classifyEmailConfirmationHash", () => {
  it("vrátí 'tokens' při přítomných access i refresh tokenech", () => {
    expect(
      classifyEmailConfirmationHash(
        parseAuthHashTokens("#access_token=a&refresh_token=b&type=signup")
      )
    ).toBe("tokens");
  });

  it("vrátí 'error' při chybovém hashi", () => {
    expect(
      classifyEmailConfirmationHash(
        parseAuthHashTokens("#error=access_denied&error_code=otp_expired")
      )
    ).toBe("error");
  });

  it("vrátí 'none' pro prázdný hash (běžná čekací stránka)", () => {
    expect(classifyEmailConfirmationHash(parseAuthHashTokens(""))).toBe("none");
  });

  it("vrátí 'none', pokud chybí refresh token", () => {
    expect(
      classifyEmailConfirmationHash(parseAuthHashTokens("#access_token=a"))
    ).toBe("none");
  });

  it("chyba má přednost i při přítomných tokenech", () => {
    expect(
      classifyEmailConfirmationHash(
        parseAuthHashTokens(
          "#access_token=a&refresh_token=b&error_code=otp_expired"
        )
      )
    ).toBe("error");
  });
});
