"use server";

import { requireAppAdmin } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";

export async function getAdminAuditLog() {
  const result = await requireAppAdmin();
  if (!result.ok) {
    throw new Error(result.error);
  }

  const { supabase } = result;

  const { data, error } = await supabase.rpc("get_admin_audit_log");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}