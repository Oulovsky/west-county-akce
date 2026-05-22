"use server";

import { revalidatePath } from "next/cache";
import { getPaymentAmount, getApprovedMinutes, formatMoneyCzk } from "@/lib/payments";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { requireAppAdminOrSef } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";
import { parseOverrideAmountCzk } from "@/lib/admin/work-payout-override";

async function requirePaymentManager() {
  try {
    return await requireAppAdminOrSef();
  } catch {
    throw new Error("Nemáte oprávnění označit práci jako proplacenou.");
  }
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

export async function markZakazkaEmployeeWorkPaidAction(formData: FormData) {
  const zakazkaId = String(formData.get("zakazka_id") ?? "").trim();
  const employeeUserId = String(formData.get("user_id") ?? "").trim();
  if (!zakazkaId || !employeeUserId) {
    throw new Error("Chybí zakázka nebo zaměstnanec.");
  }

  const { supabase, user } = await requirePaymentManager();

  const { data: attendanceRows, error: attendanceError } = await supabase
    .from("dochazka_zakazky")
    .select("id, zakazka_id, user_id, checkout_at, approved_duration_minutes, payment_status")
    .eq("zakazka_id", zakazkaId)
    .eq("user_id", employeeUserId)
    .eq("payment_status", "ceka_na_proplaceni")
    .not("checkout_at", "is", null);

  if (attendanceError) throw new Error(attendanceError.message);

  const pendingRows = attendanceRows ?? [];
  if (pendingRows.length === 0) {
    throw new Error("Pro tohoto zaměstnance na zakázce není co proplatit.");
  }

  const { data: employee, error: employeeError } = await supabase
    .from("profiles")
    .select("hodinovy_naklad_akce")
    .eq("user_id", employeeUserId)
    .maybeSingle();

  if (employeeError) throw new Error(employeeError.message);

  const hourlyRate = Number(employee?.hodinovy_naklad_akce ?? 0);
  const paidAt = new Date().toISOString();
  const attendanceIds = pendingRows.map((row) => row.id);
  let totalAmount = 0;

  for (const row of pendingRows) {
    const approvedMinutes = getApprovedMinutes(row);
    totalAmount += getPaymentAmount(approvedMinutes, hourlyRate);
  }

  const { data: payoutOverride } = await supabase
    .from("dochazka_payout_overrides")
    .select("override_amount_czk")
    .eq("zakazka_id", zakazkaId)
    .eq("user_id", employeeUserId)
    .maybeSingle();

  const loggedAmount =
    payoutOverride?.override_amount_czk != null
      ? Number(payoutOverride.override_amount_czk)
      : totalAmount;

  const { error: updateError } = await supabase
    .from("dochazka_zakazky")
    .update({
      payment_status: "proplaceno",
      paid_at: paidAt,
      paid_by: user.id,
      updated_at: paidAt,
    })
    .in("id", attendanceIds);

  if (updateError) throw new Error(updateError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "attendance_paid",
    actorId: user.id,
    title: "Práce zaměstnance na zakázce byla označena jako proplacená.",
    detail: `${pendingRows.length} intervalů · ${formatMoneyCzk(loggedAmount)}`,
    metadata: {
      target_user_id: employeeUserId,
      attendance_ids: attendanceIds,
      amount_czk: loggedAmount,
      calculated_amount_czk: totalAmount,
      override_amount_czk: payoutOverride?.override_amount_czk ?? null,
    },
  });

  revalidatePath("/admin/proplaceni");
  revalidatePath("/moje");
  revalidatePath(`/zakazky/${zakazkaId}`);
}

export async function saveWorkPayoutOverrideAction(formData: FormData) {
  const zakazkaId = String(formData.get("zakazka_id") ?? "").trim();
  const employeeUserId = String(formData.get("user_id") ?? "").trim();
  const amountRaw = String(formData.get("override_amount_czk") ?? "");
  const correctionNote = String(formData.get("correction_note") ?? "").trim();

  if (!zakazkaId || !employeeUserId) {
    throw new Error("Chybí zakázka nebo zaměstnanec.");
  }

  const { supabase, user } = await requirePaymentManager();
  const overrideAmount = parseOverrideAmountCzk(amountRaw);

  if (overrideAmount === null) {
    const { error } = await supabase
      .from("dochazka_payout_overrides")
      .delete()
      .eq("zakazka_id", zakazkaId)
      .eq("user_id", employeeUserId);

    if (error) throw new Error(error.message);
  } else {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("dochazka_payout_overrides").upsert(
      {
        zakazka_id: zakazkaId,
        user_id: employeeUserId,
        override_amount_czk: overrideAmount,
        correction_note: correctionNote || null,
        updated_by: user.id,
        updated_at: updatedAt,
      },
      { onConflict: "zakazka_id,user_id" }
    );

    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/proplaceni");
}

export async function clearWorkPayoutOverrideAction(formData: FormData) {
  const zakazkaId = String(formData.get("zakazka_id") ?? "").trim();
  const employeeUserId = String(formData.get("user_id") ?? "").trim();
  if (!zakazkaId || !employeeUserId) {
    throw new Error("Chybí zakázka nebo zaměstnanec.");
  }

  const { supabase } = await requirePaymentManager();
  const { error } = await supabase
    .from("dochazka_payout_overrides")
    .delete()
    .eq("zakazka_id", zakazkaId)
    .eq("user_id", employeeUserId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/proplaceni");
}

export async function approveTravelReimbursementAction(formData: FormData) {
  const travelId = String(formData.get("travel_id") ?? "").trim();
  if (!travelId) throw new Error("Chybí ID cestovní náhrady.");

  const { supabase, user } = await requirePaymentManager();
  const approvedAt = new Date().toISOString();
  const { data: travel, error: travelError } = await supabase
    .from("cestovni_nahrady")
    .select("id, zakazka_id, user_id, km, sazba_za_km, castka, status")
    .eq("id", travelId)
    .maybeSingle();

  if (travelError) throw new Error(travelError.message);
  if (!travel) throw new Error("Cestovní náhrada nebyla nalezena.");

  const { error: updateError } = await supabase
    .from("cestovni_nahrady")
    .update({
      status: "schvaleno",
      approved_by: user.id,
      approved_at: approvedAt,
      rejected_reason: null,
      updated_at: approvedAt,
    })
    .eq("id", travelId);

  if (updateError) throw new Error(updateError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId: travel.zakazka_id,
    eventType: "travel_reimbursement_approved",
    actorId: user.id,
    title: "Cestovní náhrada byla schválena.",
    detail: formatMoneyCzk(Number(travel.castka ?? 0)),
    metadata: { travel_id: travelId, target_user_id: travel.user_id },
  });

  await createNotification(supabase, {
    userId: travel.user_id,
    type: "travel_reimbursement_approved",
    priority: "info",
    title: "Cestovní náhrada byla schválena",
    message: formatMoneyCzk(Number(travel.castka ?? 0)),
    relatedZakazkaId: travel.zakazka_id,
    actionUrl: "/moje",
    dedupeKey: `travel-approved:${travelId}`,
  });

  revalidatePath("/admin/proplaceni");
  revalidatePath("/moje");
  revalidatePath(`/zakazky/${travel.zakazka_id}`);
}

export async function rejectTravelReimbursementAction(formData: FormData) {
  const travelId = String(formData.get("travel_id") ?? "").trim();
  const reason = String(formData.get("rejected_reason") ?? "").trim();
  if (!travelId) throw new Error("Chybí ID cestovní náhrady.");
  if (!reason) throw new Error("Důvod zamítnutí je povinný.");

  const { supabase, user } = await requirePaymentManager();
  const { data: travel, error: travelError } = await supabase
    .from("cestovni_nahrady")
    .select("id, zakazka_id, user_id")
    .eq("id", travelId)
    .maybeSingle();

  if (travelError) throw new Error(travelError.message);
  if (!travel) throw new Error("Cestovní náhrada nebyla nalezena.");

  const { error: updateError } = await supabase
    .from("cestovni_nahrady")
    .update({
      status: "zamitnuto",
      rejected_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", travelId);

  if (updateError) throw new Error(updateError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId: travel.zakazka_id,
    eventType: "travel_reimbursement_rejected",
    actorId: user.id,
    title: "Cestovní náhrada byla zamítnuta.",
    detail: reason,
    metadata: { travel_id: travelId, target_user_id: travel.user_id },
  });

  await createNotification(supabase, {
    userId: travel.user_id,
    type: "travel_reimbursement_rejected",
    priority: "warning",
    title: "Cestovní náhrada byla zamítnuta",
    message: reason,
    relatedZakazkaId: travel.zakazka_id,
    actionUrl: "/moje",
    dedupeKey: `travel-rejected:${travelId}`,
  });

  revalidatePath("/admin/proplaceni");
  revalidatePath("/moje");
  revalidatePath(`/zakazky/${travel.zakazka_id}`);
}

export async function markTravelReimbursementPaidAction(formData: FormData) {
  const travelId = String(formData.get("travel_id") ?? "").trim();
  if (!travelId) throw new Error("Chybí ID cestovní náhrady.");

  const { supabase, user } = await requirePaymentManager();
  const { data: travel, error: travelError } = await supabase
    .from("cestovni_nahrady")
    .select("id, zakazka_id, user_id, castka, status")
    .eq("id", travelId)
    .maybeSingle();

  if (travelError) throw new Error(travelError.message);
  if (!travel) throw new Error("Cestovní náhrada nebyla nalezena.");
  if (travel.status !== "schvaleno" && travel.status !== "proplaceno") {
    throw new Error("Proplatit lze jen schválenou cestovní náhradu.");
  }

  const paidAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("cestovni_nahrady")
    .update({
      status: "proplaceno",
      paid_by: user.id,
      paid_at: paidAt,
      updated_at: paidAt,
    })
    .eq("id", travelId);

  if (updateError) throw new Error(updateError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId: travel.zakazka_id,
    eventType: "travel_reimbursement_paid",
    actorId: user.id,
    title: "Cestovní náhrada byla označena jako proplacená.",
    detail: formatMoneyCzk(Number(travel.castka ?? 0)),
    metadata: { travel_id: travelId, target_user_id: travel.user_id },
  });

  await createNotification(supabase, {
    userId: travel.user_id,
    type: "travel_reimbursement_paid",
    priority: "info",
    title: "Cestovní náhrada byla proplacena",
    message: formatMoneyCzk(Number(travel.castka ?? 0)),
    relatedZakazkaId: travel.zakazka_id,
    actionUrl: "/moje",
    dedupeKey: `travel-paid:${travelId}`,
  });

  revalidatePath("/admin/proplaceni");
  revalidatePath("/moje");
  revalidatePath(`/zakazky/${travel.zakazka_id}`);
}
