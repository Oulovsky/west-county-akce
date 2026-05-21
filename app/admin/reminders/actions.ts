"use server";

import { revalidatePath } from "next/cache";
import { requireAppAdminOrSef } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";
import { runReminderEngine } from "@/lib/reminder-engine";
import type { ReminderEngineActionState } from "./state";

export async function runReminderEngineAction(
  _previousState: ReminderEngineActionState,
  _formData: FormData
): Promise<ReminderEngineActionState> {
  try {
    const { supabase } = await requireAppAdminOrSef();

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
