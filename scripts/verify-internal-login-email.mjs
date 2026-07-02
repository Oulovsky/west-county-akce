/**
 * Ověření interního přihlášení pro konkrétní e-mail (service role, read-only).
 * Spuštění: npx tsx scripts/verify-internal-login-email.mjs prchal.jarda@gmail.com
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const targetEmail = process.argv[2] ?? "prchal.jarda@gmail.com";

const url =
  process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const rulesUrl = new URL("../lib/auth/internal-access-rules.ts", import.meta.url).href;
const normalizeUrl = new URL("../lib/auth/normalize-auth-email.ts", import.meta.url).href;

const { isEmployeeLoginAllowed, isProvisionedInternalProfile } = await import(rulesUrl);
const { normalizeAuthEmailForComparison, emailsMatchForAuthComparison } =
  await import(normalizeUrl);

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function summarizeProfile(profile) {
  if (!profile) return null;
  return {
    user_id: profile.user_id,
    email: profile.email,
    role: profile.role,
    aktivni: profile.aktivni,
    jmeno: profile.jmeno,
    prijmeni: profile.prijmeni,
    provisioned: isProvisionedInternalProfile(profile),
  };
}

async function findAuthUsersByEmail(email) {
  const matches = [];
  const normalizedTarget = normalizeAuthEmailForComparison(email);
  let page = 1;

  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);

    for (const user of data.users ?? []) {
      if (emailsMatchForAuthComparison(user.email, email)) {
        matches.push(user);
      }
    }

    if ((data.users ?? []).length < 200) break;
    page += 1;
  }

  return { matches, normalizedTarget };
}

const { matches, normalizedTarget } = await findAuthUsersByEmail(targetEmail);

console.log(`\n=== Interní login check: ${targetEmail} ===`);
console.log(`Normalizovaný klíč: ${normalizedTarget ?? "(null)"}`);

if (matches.length === 0) {
  console.log("\n❌ Auth uživatel s tímto e-mailem (včetně Gmail variant) NEEXISTUJE.");
  console.log(
    "   → V adminu vytvořte zaměstnance s e-mailem prchal.jarda@gmail.com (createEmployee)."
  );
  console.log(
    "   → Šéf se pak musí poprvé přihlásit přes Google na /login stejným Google účtem."
  );
  process.exit(1);
}

let anyAllowed = false;

for (const user of matches) {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(user.id);
  const fullUser = userData?.user ?? user;
  const providers = (fullUser.identities ?? [])
    .map((i) => i.provider?.toLowerCase())
    .filter(Boolean);
  const hasGoogle = providers.includes("google");

  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, email, role, aktivni, jmeno, prijmeni")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: clientAccount } = await admin
    .from("client_accounts")
    .select("account_id, stav, klient_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasActiveClientAccount =
    clientAccount?.stav === "active" && Boolean(clientAccount.klient_id);

  const { data: systemAdminRows } = await admin
    .from("system_admin_emails")
    .select("email");

  const isSystemAdmin = (systemAdminRows ?? []).some((row) =>
    emailsMatchForAuthComparison(row.email, user.email)
  );

  const googleLoginAllowed = isEmployeeLoginAllowed(profile ?? null, {
    authProviders: ["google"],
    hasActiveClientAccount,
    isSystemAdminEmail: isSystemAdmin,
  });

  const emailPasswordAllowed = isEmployeeLoginAllowed(profile ?? null, {
    authProviders: providers.length ? providers : ["email"],
    hasActiveClientAccount,
    isSystemAdminEmail: isSystemAdmin,
  });

  const emailOnlyBlocked =
    hasActiveClientAccount &&
    !hasGoogle &&
    isProvisionedInternalProfile(profile ?? null);

  console.log(`\n--- Auth user ${user.id} ---`);
  console.log(`  email (auth): ${user.email}`);
  console.log(`  auth identity providers (DB): ${providers.join(", ") || "(žádné)"}`);
  console.log(
    `  /login Google OAuth → interní sekce: ${googleLoginAllowed ? "✅ ANO" : "❌ NE"}`
  );
  console.log(
    `  e-mail/heslo (portál) → interní sekce: ${emailPasswordAllowed ? "✅ ANO" : "❌ NE"}`
  );
  console.log(`  profile:`, summarizeProfile(profile));
  console.log(`  active client_account: ${hasActiveClientAccount ? "ano" : "ne"}`);
  console.log(`  system_admin_emails: ${isSystemAdmin ? "ano" : "ne"}`);

  if (!profile) {
    console.log("  důvod: chybí řádek v profiles (createEmployee v /admin)");
  } else if (!googleLoginAllowed && !isProvisionedInternalProfile(profile)) {
    console.log("  důvod: profil není provisioned (chybí jméno/příjmení u ne-admin role)");
  } else if (!googleLoginAllowed && emailOnlyBlocked) {
    console.log("  důvod: stejný účet má aktivní klientský portál jen přes e-mail/heslo");
  } else if (!googleLoginAllowed) {
    console.log("  důvod: profil nesplňuje podmínky interního přístupu");
  }

  if (googleLoginAllowed) anyAllowed = true;
}

console.log(
  anyAllowed
    ? `\n✅ Závěr: ${targetEmail} MŮŽE vstoupit do interní sekce přes /login (Google).`
    : `\n❌ Závěr: ${targetEmail} NEMŮŽE vstoupit do interní sekce — viz důvody výše.`
);

process.exit(anyAllowed ? 0 : 1);
