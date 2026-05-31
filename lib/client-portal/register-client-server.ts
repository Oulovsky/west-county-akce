import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeIco } from "@/lib/ares/klient-ares";
import type { ClientRegistrationFormSnapshot } from "@/lib/client-portal/registration-snapshot";
import { splitContactName } from "@/lib/client-portal/registration-snapshot";
import type { ClientRegistrationSnapshot } from "@/lib/client-portal/registration-snapshot";
import { createAdminClient } from "@/lib/supabase/admin";

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
      throw new Error(byIcoError.message);
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
    throw new Error(error?.message ?? "Nepodařilo se vytvořit klienta.");
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
    throw new Error(existingAccountError.message);
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
      throw new Error(accountError.message);
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
      throw new Error(accountError.message);
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
    throw new Error(registrationError.message);
  }

  return { klientId };
}
