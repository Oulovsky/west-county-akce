"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runReminderEngine } from "@/lib/reminder-engine";
import type { ReminderEngineActionState } from "./state";

export async function runReminderEngineAction(
  _previousState: ReminderEngineActionState,
  _formData: FormData
): Promise<ReminderEngineActionState> {
  try {
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

    const result = await runReminderEngine(supabase);
    revalidatePath("/notifikace");
    revalidatePath("/moje");
    revalidatePath("/admin/reminders");

    return {
      ok: true,
      error: null,
      result,
      runId: Date.now(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Reminder engine selhal.",
      result: null,
      runId: Date.now(),
    };
  }
}
