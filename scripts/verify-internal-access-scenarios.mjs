/**
 * Spuštění: npx tsx scripts/verify-internal-access-scenarios.mjs
 * (tsx spustí import .ts modulů z lib/auth)
 */
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenariosUrl = pathToFileURL(
  join(__dirname, "..", "lib", "auth", "internal-access-scenarios.ts")
).href;
const normalizeScenariosUrl = pathToFileURL(
  join(__dirname, "..", "lib", "auth", "normalize-auth-email-scenarios.ts")
).href;

const { runInternalAccessScenarios } = await import(scenariosUrl);
const { runNormalizeAuthEmailScenarios, runEmailDomainHintScenarios } = await import(
  normalizeScenariosUrl
);

const results = [
  ...runInternalAccessScenarios(),
  ...runNormalizeAuthEmailScenarios(),
  ...runEmailDomainHintScenarios(),
];
let failed = 0;

for (const row of results) {
  const mark = row.ok ? "OK" : "FAIL";
  console.log(`${mark}  ${row.name}`);
  if (!row.ok) failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} scenario(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${results.length} scenarios passed.`);
