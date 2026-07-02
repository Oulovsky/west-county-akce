import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLIENT_EMAIL_NOT_VERIFIED,
  shouldTreatClientAsEmailUnverified,
} from "@/lib/auth/client-email-verification";
import type { ClientAccount } from "@/lib/client-portal/types";

export type ClientPortalSession =
  | { kind: "guest" }
  | { kind: "authenticated_no_registration"; userId: string; email: string | null }
  | {
      kind: "email_unverified";
      account: ClientAccount;
      klientNazev: string | null;
      email: string;
      emailConfirmationLastSentAt: string | null;
    }
  | { kind: "active"; account: ClientAccount; klientNazev: string | null }
  | { kind: "disabled"; account: ClientAccount };

export async function loadClientAccount(
  supabase: SupabaseClient,
  userId: string
) {
  return supabase
    .from("client_accounts")
    .select(
      "account_id, user_id, klient_id, role, stav, jmeno, prijmeni, telefon, schvalil_user_id, schvaleno_at, email_confirmation_last_sent_at, created_at, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();
}

export async function loadLatestClientRegistration(
  supabase: SupabaseClient,
  userId: string
) {
  return supabase
    .from("client_registrations")
    .select(
      "registration_id, user_id, navrh_ico, navrh_nazev_firmy, ares_snapshot, stav, klient_id, schvalil_user_id, schvaleno_at, zamitnuto_duvod, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function loadClientPortalSession(
  supabase: SupabaseClient
): Promise<ClientPortalSession> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { kind: "guest" };
  }

  const { data: account } = await loadClientAccount(supabase, user.id);

  if (account?.stav === "active" && account.klient_id) {
    const { data: klient } = await supabase
      .from("klienti")
      .select("nazev")
      .eq("klient_id", account.klient_id)
      .maybeSingle();

    const klientNazev = klient?.nazev ?? null;

    if (shouldTreatClientAsEmailUnverified(account, user)) {
      return {
        kind: "email_unverified",
        account: account as ClientAccount,
        klientNazev,
        email: user.email ?? "",
        emailConfirmationLastSentAt:
          (account.email_confirmation_last_sent_at as string | null) ?? null,
      };
    }

    return {
      kind: "active",
      account: account as ClientAccount,
      klientNazev,
    };
  }

  if (account?.stav === "disabled") {
    return {
      kind: "disabled",
      account: account as ClientAccount,
    };
  }

  return {
    kind: "authenticated_no_registration",
    userId: user.id,
    email: user.email ?? null,
  };
}

export async function requireActiveClientPortalSession(supabase: SupabaseClient) {
  const session = await loadClientPortalSession(supabase);
  if (session.kind === "email_unverified") {
    throw new Error(CLIENT_EMAIL_NOT_VERIFIED);
  }
  if (session.kind !== "active") {
    throw new Error("CLIENT_PORTAL_FORBIDDEN");
  }
  return session;
}
