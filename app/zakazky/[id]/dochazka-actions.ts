"use server";

import { revalidatePath } from "next/cache";
import { getRolePermissions } from "@/lib/roles";
import { getAttendanceMinutes, getAttendancePhaseLabel } from "@/lib/zakazka-attendance";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { createClient } from "@/lib/supabase/server";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function requireDate(value: string, label: string) {
  if (!value) throw new Error(`${label} je povinný.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} není platné datum.`);
  return date.toISOString();
}

async function requireAttendanceEditor() {
  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Pro úpravu docházky musíte být přihlášeni.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  const perms = getRolePermissions(profile?.role);
  if (!perms.zakazkyEditace) throw new Error("Nemáte oprávnění upravovat docházku.");

  return { supabase, user };
}

export async function updateAttendanceManualAction(formData: FormData) {
  const attendanceId = text(formData, "attendance_id");
  const reason = text(formData, "override_reason");
  const checkinAt = requireDate(text(formData, "checkin_at"), "Začátek práce");
  const checkoutRaw = text(formData, "checkout_at");
  const checkoutAt = checkoutRaw ? requireDate(checkoutRaw, "Konec práce") : null;

  if (!attendanceId) throw new Error("Chybí ID docházky.");
  if (!reason) throw new Error("U ruční opravy je povinný důvod.");
  if (checkoutAt && new Date(checkoutAt).getTime() < new Date(checkinAt).getTime()) {
    throw new Error("Konec práce musí být později než začátek.");
  }

  const { supabase, user } = await requireAttendanceEditor();
  const { data: current, error: currentError } = await supabase
    .from("dochazka_zakazky")
    .select("id, zakazka_id, assignment_id, user_id, typ_faze, checkin_at, checkout_at")
    .eq("id", attendanceId)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("Docházka nebyla nalezena.");

  const now = new Date().toISOString();
  const approvedMinutes = getAttendanceMinutes(checkinAt, checkoutAt);
  const { error: updateError } = await supabase
    .from("dochazka_zakazky")
    .update({
      checkin_at: checkinAt,
      checkout_at: checkoutAt,
      approved_duration_minutes: approvedMinutes,
      manual_override: true,
      override_reason: reason,
      approved_by: user.id,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", attendanceId);

  if (updateError) throw new Error(updateError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId: current.zakazka_id,
    eventType: "attendance_manual_override",
    actorId: user.id,
    title: `Docházka ručně opravena: ${getAttendancePhaseLabel(current.typ_faze)}.`,
    detail: reason,
    metadata: {
      attendance_id: attendanceId,
      assignment_id: current.assignment_id,
      target_user_id: current.user_id,
      previous_checkin_at: current.checkin_at,
      previous_checkout_at: current.checkout_at,
      next_checkin_at: checkinAt,
      next_checkout_at: checkoutAt,
      worked_minutes: approvedMinutes,
    },
  });

  revalidatePath(`/zakazky/${current.zakazka_id}`);
  revalidatePath("/moje");
  revalidatePath(`/moje/zakazky/${current.zakazka_id}`);
}
