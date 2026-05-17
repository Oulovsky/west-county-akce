"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runReminderEngine } from "@/lib/reminder-engine";

export async function runReminderEngineAction() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Pro spuštění reminderů musíte být přihlášeni.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile || (profile.role !== "admin" && profile.role !== "sef")) {
    throw new Error("Reminder engine může spustit jen admin nebo šéf.");
  }

  await runReminderEngine(supabase);
  revalidatePath("/notifikace");
  revalidatePath("/admin/reminders");
}
