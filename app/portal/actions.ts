"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeIco } from "@/lib/ares/klient-ares";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { activateClientPortalRegistration } from "@/lib/client-portal/register-client-server";
import {
  buildClientRegistrationSnapshot,
  splitContactName,
} from "@/lib/client-portal/registration-snapshot";
import type { AresSubject } from "@/lib/ares/klient-ares";
import { createClient } from "@/lib/supabase/server";

function revalidatePortalPaths() {
  revalidatePath("/portal");
  revalidatePath("/portal/prihlaseni");
  revalidatePath("/portal/registrace");
  revalidatePath("/portal/profil");
  revalidatePath("/portal/poptavky");
  revalidatePath("/admin/client-registrace");
}

export async function portalSignInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "").trim();

  if (!email || !password) {
    redirect("/portal/prihlaseni?error=missing_fields");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/portal/prihlaseni?error=invalid_credentials");
  }

  const session = await loadClientPortalSession(supabase);
  revalidatePortalPaths();

  if (session.kind === "active") {
    redirect(next.startsWith("/portal") ? next : "/portal");
  }

  redirect("/portal");
}

export async function portalSignOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePortalPaths();
  redirect("/portal/prihlaseni");
}

export async function portalRegisterAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const ico = normalizeIco(String(formData.get("ico") ?? ""));
  const nazev = String(formData.get("nazev") ?? "").trim();
  const ulice = String(formData.get("ulice") ?? "").trim();
  const mesto = String(formData.get("mesto") ?? "").trim();
  const psc = String(formData.get("psc") ?? "").trim();
  const dic = String(formData.get("dic") ?? "").trim();
  const telefon = String(formData.get("telefon") ?? "").trim();
  const kontaktJmeno = String(formData.get("kontakt_jmeno") ?? "").trim();
  const poznamka = String(formData.get("poznamka") ?? "").trim();
  const aresSubjectRaw = String(formData.get("ares_subject_json") ?? "").trim();

  if (!email || !password || !nazev || !ico || !kontaktJmeno || !telefon) {
    redirect("/portal/registrace?error=missing_fields");
  }

  if (password.length < 8) {
    redirect("/portal/registrace?error=weak_password");
  }

  if (password !== passwordConfirm) {
    redirect("/portal/registrace?error=password_mismatch");
  }

  if (!/^\d{8}$/.test(ico)) {
    redirect("/portal/registrace?error=invalid_ico");
  }

  const supabase = await createClient();

  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  if (existingUser) {
    const existingSession = await loadClientPortalSession(supabase);
    if (existingSession.kind === "active") {
      redirect("/portal/registrace?error=already_signed_in");
    }
  }

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError || !signUpData.user) {
      redirect("/portal/registrace?error=signup_failed");
    }

    userId = signUpData.user.id;
  }

  let aresSubject: AresSubject | null = null;
  if (aresSubjectRaw) {
    try {
      aresSubject = JSON.parse(aresSubjectRaw) as AresSubject;
    } catch {
      aresSubject = null;
    }
  }

  const snapshot = buildClientRegistrationSnapshot({
    aresSubject,
    form: {
      nazev,
      ulice,
      mesto,
      psc,
      ico,
      dic,
      telefon,
      email,
      kontakt_jmeno: kontaktJmeno,
      poznamka,
    },
  });

  try {
    await activateClientPortalRegistration({
      userId,
      snapshot,
      ico,
      nazev,
    });
  } catch {
    if (!existingUser) {
      await supabase.auth.signOut();
    }
    redirect("/portal/registrace?error=registration_save_failed");
  }

  revalidatePortalPaths();
  redirect("/portal?registered=1");
}

export async function portalUpdateProfilAction(formData: FormData) {
  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);

  if (session.kind !== "active") {
    redirect("/portal/prihlaseni");
  }

  const telefon = String(formData.get("telefon") ?? "").trim();
  const kontaktJmeno = String(formData.get("kontakt_jmeno") ?? "").trim();
  const { jmeno, prijmeni } = splitContactName(kontaktJmeno);

  const { error: accountError } = await supabase
    .from("client_accounts")
    .update({
      telefon: telefon || null,
      jmeno,
      prijmeni,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", session.account.account_id);

  if (accountError) {
    redirect("/portal/profil?error=save_failed");
  }

  revalidatePortalPaths();
  redirect("/portal/profil?saved=1");
}
