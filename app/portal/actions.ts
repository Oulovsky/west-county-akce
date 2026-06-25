"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeIco } from "@/lib/ares/klient-ares";
import type { AresSubject } from "@/lib/ares/klient-ares";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { registerClientPortalAccount } from "@/lib/client-portal/portal-register-server";
import { splitContactName } from "@/lib/client-portal/registration-snapshot";
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

  let aresSubject: AresSubject | null = null;
  if (aresSubjectRaw) {
    try {
      aresSubject = JSON.parse(aresSubjectRaw) as AresSubject;
    } catch {
      aresSubject = null;
    }
  }

  const result = await registerClientPortalAccount({
    email,
    password,
    passwordConfirm,
    ico,
    nazev,
    ulice,
    mesto,
    psc,
    dic,
    telefon,
    kontaktJmeno,
    poznamka,
    aresSubject,
  });

  if (!result.ok) {
    redirect(`/portal/registrace?error=${encodeURIComponent(result.code)}`);
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
