import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  checkSystemAdminEmail,
  hasAppAdminAccess,
  hasAppAdminOrSefAccess,
  isAdminRole,
  normalizeAuthEmail,
} from "@/lib/auth/admin-access";
import { INTERNAL_WRITE_FORBIDDEN_MESSAGE } from "@/lib/auth/internal-role-access";
import { isReadOnlyInternalRole } from "@/lib/roles";

export type RequireAppAdminResult =
  | {
      ok: true;
      supabase: SupabaseClient;
      user: { id: string; email?: string | null };
      profile: { role: string };
    }
  | {
      ok: false;
      supabase: SupabaseClient;
      error: string;
    };

export async function requireAppAdmin(): Promise<RequireAppAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, supabase, error: "Unauthorized" };
  }

  const email = normalizeAuthEmail(user.email);
  if (!email) {
    return { ok: false, supabase, error: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    return { ok: false, supabase, error: profileError.message };
  }

  if (isAdminRole(profile?.role)) {
    return { ok: true, supabase, user, profile: profile! };
  }

  const systemCheck = await checkSystemAdminEmail(supabase, email);
  if (systemCheck.error) {
    return { ok: false, supabase, error: systemCheck.error };
  }

  if (!profile || !hasAppAdminAccess(profile.role, systemCheck.isSystemAdmin)) {
    return { ok: false, supabase, error: "Forbidden" };
  }

  return { ok: true, supabase, user, profile };
}

export async function assertAppAdmin(): Promise<SupabaseClient> {
  const result = await requireAppAdmin();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.supabase;
}

export async function assertAppAdminWithClient(
  supabase: SupabaseClient
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const email = normalizeAuthEmail(user.email);
  if (!email) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (isAdminRole(profile?.role)) {
    return;
  }

  const systemCheck = await checkSystemAdminEmail(supabase, email);
  if (systemCheck.error) {
    throw new Error(systemCheck.error);
  }

  if (!profile || !hasAppAdminAccess(profile.role, systemCheck.isSystemAdmin)) {
    throw new Error("Forbidden");
  }
}

export async function verifyAppAdminPage(
  supabase?: SupabaseClient
): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { ok: false, message: "Unauthorized" };
  }

  const email = normalizeAuthEmail(user.email);
  if (!email) {
    return { ok: false, message: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    return { ok: false, message: profileError.message };
  }

  if (isAdminRole(profile?.role)) {
    return { ok: true };
  }

  const systemCheck = await checkSystemAdminEmail(client, email);
  if (systemCheck.error) {
    return { ok: false, message: systemCheck.error };
  }

  if (!profile || !hasAppAdminAccess(profile.role, systemCheck.isSystemAdmin)) {
    return { ok: false, message: "Forbidden" };
  }

  return { ok: true };
}

export async function verifyAppAdminOrSefPage(
  supabase?: SupabaseClient
): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { ok: false, message: "Unauthorized" };
  }

  const email = normalizeAuthEmail(user.email);
  if (!email) {
    return { ok: false, message: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, message: profileError.message };
  }

  if (!profile) {
    return { ok: false, message: "Forbidden" };
  }

  if (profile.role === "sef") {
    return { ok: true };
  }

  if (isAdminRole(profile.role)) {
    return { ok: true };
  }

  const systemCheck = await checkSystemAdminEmail(client, email);
  if (systemCheck.error) {
    return { ok: false, message: systemCheck.error };
  }

  if (!hasAppAdminOrSefAccess(profile.role, systemCheck.isSystemAdmin)) {
    return { ok: false, message: "Forbidden" };
  }

  return { ok: true };
}

export async function verifyInternalKlientiReadPage(
  supabase?: SupabaseClient
): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { ok: false, message: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, message: profileError.message };
  }

  const role = profile?.role ?? null;
  if (role === "admin" || role === "sef" || role === "hdt") {
    return { ok: true };
  }

  const email = normalizeAuthEmail(user.email);
  if (!email) {
    return { ok: false, message: "Forbidden" };
  }

  const systemCheck = await checkSystemAdminEmail(client, email);
  if (systemCheck.error) {
    return { ok: false, message: systemCheck.error };
  }

  if (hasAppAdminAccess(role, systemCheck.isSystemAdmin)) {
    return { ok: true };
  }

  return { ok: false, message: "Forbidden" };
}

export async function verifyInternalPoptavkyReadPage(
  supabase?: SupabaseClient
): Promise<{ ok: true } | { ok: false; message: string }> {
  return verifyInternalKlientiReadPage(supabase);
}

export async function requireInternalWriteAdminOrSef(): Promise<{
  supabase: SupabaseClient;
  user: { id: string; email?: string | null };
}> {
  return requireAppAdminOrSef();
}

export async function requireAppAdminOrSef(): Promise<{
  supabase: SupabaseClient;
  user: { id: string; email?: string | null };
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  const email = normalizeAuthEmail(user.email);
  if (!email) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error("Forbidden");
  }

  if (profile.role === "sef" || isAdminRole(profile.role)) {
    return { supabase, user };
  }

  if (isReadOnlyInternalRole(profile.role)) {
    throw new Error(INTERNAL_WRITE_FORBIDDEN_MESSAGE);
  }

  const systemCheck = await checkSystemAdminEmail(supabase, email);
  if (systemCheck.error) {
    throw new Error(systemCheck.error);
  }

  if (!hasAppAdminOrSefAccess(profile.role, systemCheck.isSystemAdmin)) {
    throw new Error(INTERNAL_WRITE_FORBIDDEN_MESSAGE);
  }

  return { supabase, user };
}
