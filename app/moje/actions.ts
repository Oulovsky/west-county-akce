"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { markZakazkaCriticalChangeIfApproved } from "@/lib/zakazka-critical-changes";

async function getCurrentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Pro potvrzení účasti musíte být přihlášeni.");
  }

  return { supabase, userId: user.id };
}

export async function acceptAssignmentAction(assignmentId: string) {
  const { supabase, userId } = await getCurrentUserId();
  const { data: assignment, error: assignmentError } = await supabase
    .from("zakazka_lide")
    .select("id, zakazka_id")
    .eq("id", assignmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  const { error } = await supabase
    .from("zakazka_lide")
    .update({
      confirmation_status: "accepted",
      declined_reason: null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", assignmentId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/moje");
}

export async function declineAssignmentAction(assignmentId: string, reason: string) {
  const trimmedReason = reason.trim();

  if (!trimmedReason) {
    throw new Error("U odmítnutí je povinné uvést důvod.");
  }

  const { supabase, userId } = await getCurrentUserId();
  const { data: assignment, error: assignmentError } = await supabase
    .from("zakazka_lide")
    .select("id, zakazka_id")
    .eq("id", assignmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  const { error } = await supabase
    .from("zakazka_lide")
    .update({
      confirmation_status: "declined",
      declined_reason: trimmedReason,
      responded_at: new Date().toISOString(),
    })
    .eq("id", assignmentId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  if (assignment?.zakazka_id) {
    const changeResult = await markZakazkaCriticalChangeIfApproved(supabase, {
      zakazkaId: assignment.zakazka_id,
      actorId: userId,
      changes: ["lide"],
      detail: "Člověk odmítl účast po klientském schválení zakázky.",
      metadata: { assignment_id: assignmentId, declined_reason: trimmedReason },
    });
    if (!changeResult.ok) throw new Error(changeResult.error);
    revalidatePath(`/zakazky/${assignment.zakazka_id}`);
  }

  revalidatePath("/moje");
}
