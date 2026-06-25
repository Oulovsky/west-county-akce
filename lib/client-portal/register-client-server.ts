import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeIco } from "@/lib/ares/klient-ares";
import type { ClientRegistrationFormSnapshot } from "@/lib/client-portal/registration-snapshot";
import { splitContactName } from "@/lib/client-portal/registration-snapshot";
import type { ClientRegistrationSnapshot } from "@/lib/client-portal/registration-snapshot";
import { createAdminClient } from "@/lib/supabase/admin";

function throwDbError(error: { message: string; code?: string; details?: string; hint?: string }) {
  const err = new Error(error.message) as Error & {
    code?: string;
    details?: string;
    hint?: string;
  };
  err.code = error.code;
  err.details = error.details;
  err.hint = error.hint;
  throw err;
}

function nullable(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

export async function findOrCreateKlientFromRegistration(
  supabase: SupabaseClient,
  form: ClientRegistrationFormSnapshot
) {
  const ico = normalizeIco(form.ico);

  if (ico) {
    const { data: byIco, error: byIcoError } = await supabase
      .from("klienti")
      .select("klient_id")
      .eq("ico", ico)
      .maybeSingle();

    if (byIcoError) {
      throwDbError(byIcoError);
    }

    if (byIco?.klient_id) {
      return byIco.klient_id as string;
    }
  }

  const { data: created, error } = await supabase
    .from("klienti")
    .insert({
      nazev: form.nazev.trim(),
      ico: nullable(form.ico),
      dic: nullable(form.dic),
      ulice: nullable(form.ulice),
      mesto: nullable(form.mesto),
      psc: nullable(form.psc),
      telefon: nullable(form.telefon),
      email: nullable(form.email),
      poznamka: nullable(form.poznamka),
      aktivni: true,
    })
    .select("klient_id")
    .single();

  if (error || !created) {
    if (error) {
      throwDbError(error);
    }
    throw new Error("Nepodařilo se vytvořit klienta.");
  }

  return created.klient_id as string;
}

export async function activateClientPortalRegistration({
  userId,
  snapshot,
  ico,
  nazev,
}: {
  userId: string;
  snapshot: ClientRegistrationSnapshot;
  ico: string;
  nazev: string;
}) {
  const admin = createAdminClient();
  const klientId = await findOrCreateKlientFromRegistration(admin, snapshot.form);
  const { jmeno, prijmeni } = splitContactName(snapshot.form.kontakt_jmeno);
  const now = new Date().toISOString();

  const { data: existingAccount, error: existingAccountError } = await admin
    .from("client_accounts")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingAccountError) {
    throwDbError(existingAccountError);
  }

  if (existingAccount?.account_id) {
    const { error: accountError } = await admin
      .from("client_accounts")
      .update({
        klient_id: klientId,
        stav: "active",
        role: "owner",
        jmeno,
        prijmeni,
        telefon: nullable(snapshot.form.telefon),
        updated_at: now,
      })
      .eq("account_id", existingAccount.account_id);

    if (accountError) {
      throwDbError(accountError);
    }
  } else {
    const { error: accountError } = await admin.from("client_accounts").insert({
      user_id: userId,
      klient_id: klientId,
      stav: "active",
      role: "owner",
      jmeno,
      prijmeni,
      telefon: nullable(snapshot.form.telefon),
      schvaleno_at: now,
    });

    if (accountError) {
      throwDbError(accountError);
    }
  }

  const { error: registrationError } = await admin.from("client_registrations").insert({
    user_id: userId,
    navrh_ico: ico,
    navrh_nazev_firmy: nazev,
    ares_snapshot: snapshot,
    stav: "approved",
    klient_id: klientId,
    schvaleno_at: now,
  });

  if (registrationError) {
    throwDbError(registrationError);
  }

  return { klientId };
}
