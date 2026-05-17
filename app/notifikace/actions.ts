"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Pro notifikace musíte být přihlášeni.");
  return { supabase, user };
}

export async function markNotificationReadAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Chybí ID notifikace.");
  const { supabase, user } = await getCurrentUser();
  const { error } = await supabase
    .from("notifikace")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/notifikace");
}

export async function dismissNotificationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Chybí ID notifikace.");
  const { supabase, user } = await getCurrentUser();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifikace")
    .update({ dismissed_at: now, read_at: now })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/notifikace");
}

export async function markAllNotificationsReadAction() {
  const { supabase, user } = await getCurrentUser();
  const { error } = await supabase
    .from("notifikace")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
    .is("dismissed_at", null);

  if (error) throw new Error(error.message);
  revalidatePath("/notifikace");
}
