"use server";

import { revalidatePath } from "next/cache";
import { getPaymentAmount, getApprovedMinutes, formatMoneyCzk } from "@/lib/payments";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { createClient } from "@/lib/supabase/server";

async function requirePaymentManager() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Pro proplacení musíte být přihlášeni.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile || (profile.role !== "admin" && profile.role !== "sef")) {
    throw new Error("Nemáte oprávnění označit práci jako proplacenou.");
  }

  return { supabase, user };
}

export async function markAttendancePaidAction(formData: FormData) {
  const attendanceId = String(formData.get("attendance_id") ?? "").trim();
  if (!attendanceId) throw new Error("Chybí ID docházky.");

  const { supabase, user } = await requirePaymentManager();
  const { data: attendance, error: attendanceError } = await supabase
    .from("dochazka_zakazky")
    .select("id, zakazka_id, user_id, typ_faze, checkin_at, checkout_at, approved_duration_minutes, payment_status")
    .eq("id", attendanceId)
    .maybeSingle();

  if (attendanceError) throw new Error(attendanceError.message);
  if (!attendance) throw new Error("Docházka nebyla nalezena.");
  if (!attendance.checkout_at) throw new Error("Nelze proplatit neukončenou práci.");

  const { data: employee, error: employeeError } = await supabase
    .from("profiles")
    .select("hodinovy_naklad_akce")
    .eq("user_id", attendance.user_id)
    .maybeSingle();

  if (employeeError) throw new Error(employeeError.message);

  const approvedMinutes = getApprovedMinutes(attendance);
  const amount = getPaymentAmount(approvedMinutes, Number(employee?.hodinovy_naklad_akce ?? 0));
  const paidAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("dochazka_zakazky")
    .update({
      payment_status: "proplaceno",
      paid_at: paidAt,
      paid_by: user.id,
      updated_at: paidAt,
    })
    .eq("id", attendanceId);

  if (updateError) throw new Error(updateError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId: attendance.zakazka_id,
    eventType: "attendance_paid",
    actorId: user.id,
    title: "Práce byla označena jako proplacená.",
    detail: `${approvedMinutes} min · ${formatMoneyCzk(amount)}`,
    metadata: {
      attendance_id: attendanceId,
      target_user_id: attendance.user_id,
      approved_duration_minutes: approvedMinutes,
      amount_czk: amount,
    },
  });

  revalidatePath("/admin/proplaceni");
  revalidatePath("/moje");
  revalidatePath(`/zakazky/${attendance.zakazka_id}`);
}
