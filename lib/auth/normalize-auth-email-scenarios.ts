import {
  emailsMatchForAuthComparison,
  getAuthEmailDisplayValue,
  normalizeAuthEmailForComparison,
} from "@/lib/auth/normalize-auth-email";
import { getEmailComTypoHint } from "@/lib/client-portal/email-domain-hint";

export type ScenarioResult = { name: string; ok: boolean };

function run(name: string, ok: boolean): ScenarioResult {
  return { name, ok };
}

export function runNormalizeAuthEmailScenarios(): ScenarioResult[] {
  const prchalWithDots = "prchal.jarda@gmail.com";
  const prchalWithoutDots = "prchaljarda@gmail.com";

  return [
    run(
      "gmail dot variants normalize to same comparison key",
      normalizeAuthEmailForComparison(prchalWithDots) ===
        normalizeAuthEmailForComparison(prchalWithoutDots)
    ),
    run(
      "gmail dot variants match for auth comparison",
      emailsMatchForAuthComparison(prchalWithDots, prchalWithoutDots)
    ),
    run(
      "gmail +tag is stripped for comparison",
      normalizeAuthEmailForComparison("prchal.jarda+work@gmail.com") ===
        "prchaljarda@gmail.com"
    ),
    run(
      "googlemail.com maps to gmail.com comparison key",
      normalizeAuthEmailForComparison("prchal.jarda@googlemail.com") ===
        "prchaljarda@gmail.com"
    ),
    run(
      "non-gmail keeps dots in local-part",
      normalizeAuthEmailForComparison("first.last@firma.cz") === "first.last@firma.cz"
    ),
    run(
      "display value preserves original gmail dots",
      getAuthEmailDisplayValue("  Prchal.Jarda@gmail.com  ") === "Prchal.Jarda@gmail.com"
    ),
    run(
      "non-gmail display only trims",
      getAuthEmailDisplayValue("  First.Last@Firma.cz  ") === "First.Last@Firma.cz"
    ),
  ];
}

export function runEmailDomainHintScenarios(): ScenarioResult[] {
  return [
    run(
      "email.com typo hint shown",
      getEmailComTypoHint("prchal.jarda@email.com") ===
        "Zadali jste adresu @email.com. Nemysleli jste @email.cz?"
    ),
    run(
      "email.cz no typo hint",
      getEmailComTypoHint("prchal.jarda@email.cz") === null
    ),
  ];
}

export function assertNormalizeAuthEmailScenarios(): void {
  const results = runNormalizeAuthEmailScenarios();
  const failed = results.filter((row) => !row.ok);
  if (failed.length > 0) {
    throw new Error(
      `Normalize auth email scenarios failed: ${failed.map((row) => row.name).join(", ")}`
    );
  }
}
