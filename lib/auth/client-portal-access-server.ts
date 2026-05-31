import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientAccount,
  ClientRegistration,
} from "@/lib/client-portal/types";

export type ClientPortalSession =
  | { kind: "guest" }
  | { kind: "authenticated_pending"; registration: ClientRegistration }
  | { kind: "authenticated_no_registration"; userId: string; email: string | null }
  | { kind: "active"; account: ClientAccount; klientNazev: string | null }
  | { kind: "disabled"; account: ClientAccount };

export async function loadClientAccount(
  supabase: SupabaseClient,
  userId: string
) {
  return supabase
    .from("client_accounts")
    .select(
      "account_id, user_id, klient_id, role, stav, jmeno, prijmeni, telefon, schvalil_user_id, schvaleno_at, created_at, updated_at"
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

  const [{ data: account }, { data: registration }] = await Promise.all([
    loadClientAccount(supabase, user.id),
    loadLatestClientRegistration(supabase, user.id),
  ]);

  if (account?.stav === "active" && account.klient_id) {
    const { data: klient } = await supabase
      .from("klienti")
      .select("nazev")
      .eq("klient_id", account.klient_id)
      .maybeSingle();

    return {
      kind: "active",
      account: account as ClientAccount,
      klientNazev: klient?.nazev ?? null,
    };
  }

  if (account?.stav === "disabled") {
    return {
      kind: "disabled",
      account: account as ClientAccount,
    };
  }

  if (registration?.stav === "pending") {
    return {
      kind: "authenticated_pending",
      registration: registration as ClientRegistration,
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
  if (session.kind !== "active") {
    throw new Error("CLIENT_PORTAL_FORBIDDEN");
  }
  return session;
}
