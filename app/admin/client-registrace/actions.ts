"use server";

import { revalidatePath } from "next/cache";
import { requireAppAdminOrSef } from "@/lib/auth/admin-access-server";
import { parseClientRegistrationSnapshot, splitContactName } from "@/lib/client-portal/registration-snapshot";
import type { ClientRegistrationFormSnapshot } from "@/lib/client-portal/registration-snapshot";
import { normalizeIco } from "@/lib/ares/klient-ares";

function nullable(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

async function findOrCreateKlient(
  supabase: Awaited<ReturnType<typeof requireAppAdminOrSef>>["supabase"],
  form: ClientRegistrationFormSnapshot
) {
  const ico = normalizeIco(form.ico);

  if (ico) {
    const { data: byIco } = await supabase
      .from("klienti")
      .select("klient_id")
      .eq("ico", ico)
      .maybeSingle();

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

export async function approveClientRegistrationAction(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "").trim();
  if (!registrationId) {
    throw new Error("Chybí registration_id.");
  }

  const { supabase, user } = await requireAppAdminOrSef();

  const { data: registration, error: loadError } = await supabase
    .from("client_registrations")
    .select(
      "registration_id, user_id, navrh_ico, navrh_nazev_firmy, ares_snapshot, stav, klient_id"
    )
    .eq("registration_id", registrationId)
    .single();

  if (loadError || !registration) {
    throw new Error(loadError?.message ?? "Registrace nenalezena.");
  }

  if (registration.stav !== "pending") {
    throw new Error("Registrace už není ve stavu pending.");
  }

  const snapshot = parseClientRegistrationSnapshot(registration.ares_snapshot);
  if (!snapshot) {
    throw new Error("Neplatná data registrace.");
  }

  const klientId =
    registration.klient_id ?? (await findOrCreateKlient(supabase, snapshot.form));

  const { jmeno, prijmeni } = splitContactName(snapshot.form.kontakt_jmeno);
  const now = new Date().toISOString();

  const { data: existingAccount } = await supabase
    .from("client_accounts")
    .select("account_id")
    .eq("user_id", registration.user_id)
    .maybeSingle();

  if (existingAccount?.account_id) {
    const { error: accountError } = await supabase
      .from("client_accounts")
      .update({
        klient_id: klientId,
        stav: "active",
        role: "owner",
        jmeno,
        prijmeni,
        telefon: nullable(snapshot.form.telefon),
        schvalil_user_id: user.id,
        schvaleno_at: now,
        updated_at: now,
      })
      .eq("account_id", existingAccount.account_id);

    if (accountError) {
      throw new Error(accountError.message);
    }
  } else {
    const { error: accountError } = await supabase.from("client_accounts").insert({
      user_id: registration.user_id,
      klient_id: klientId,
      stav: "active",
      role: "owner",
      jmeno,
      prijmeni,
      telefon: nullable(snapshot.form.telefon),
      schvalil_user_id: user.id,
      schvaleno_at: now,
    });

    if (accountError) {
      throw new Error(accountError.message);
    }
  }

  const { error: registrationError } = await supabase
    .from("client_registrations")
    .update({
      stav: "approved",
      klient_id: klientId,
      schvalil_user_id: user.id,
      schvaleno_at: now,
      updated_at: now,
    })
    .eq("registration_id", registrationId);

  if (registrationError) {
    throw new Error(registrationError.message);
  }

  revalidatePath("/admin/client-registrace");
  revalidatePath("/portal");
}

export async function rejectClientRegistrationAction(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "").trim();
  const reason = String(formData.get("zamitnuto_duvod") ?? "").trim();

  if (!registrationId || !reason) {
    throw new Error("Vyplňte důvod zamítnutí.");
  }

  const { supabase, user } = await requireAppAdminOrSef();

  const { error } = await supabase
    .from("client_registrations")
    .update({
      stav: "rejected",
      zamitnuto_duvod: reason,
      schvalil_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("registration_id", registrationId)
    .eq("stav", "pending");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/client-registrace");
}
