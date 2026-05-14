"use server";

import { createClient } from "@/lib/supabase/server";

export async function getAdminAuditLog() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase.rpc("get_admin_audit_log");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}