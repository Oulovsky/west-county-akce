"use server";

import { revalidatePath } from "next/cache";
import { defaultApprovedAmountFromMinutes, formatMoneyCzk, getClaimedMinutes } from "@/lib/payments";
import { getPayoutGroupState } from "@/lib/payout-group";
import { getTravelClaimedAmount, getTravelClaimedKm } from "@/lib/transport";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { requireAppAdminOrSef } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

async function requirePaymentManager() {
  try {
    return await requireAppAdminOrSef();
  } catch {
    throw new Error("Nemáte oprávnění spravovat proplacení.");
  }
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseOptionalNumber(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error(`Pole ${key} není platné číslo.`);
  return parsed;
}

function parseRequiredNumber(formData: FormData, key: string, label: string) {
  const parsed = parseOptionalNumber(formData, key);
  if (parsed == null) throw new Error(`${label} je povinné.`);
  return parsed;
}

function revalidatePayoutPaths(zakazkaId: string) {
  revalidatePath("/admin/proplaceni");
  revalidatePath("/moje");
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath(`/moje/zakazky/${zakazkaId}`);
}

async function loadHourlyRate(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("hodinovy_naklad_akce")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.hodinovy_naklad_akce ?? 0);
}

export async function approveAttendanceIntervalAction(formData: FormData) {
  const attendanceId = text(formData, "attendance_id");
  if (!attendanceId) throw new Error("Chybí ID docházky.");

  const { supabase, user } = await requirePaymentManager();
  const { data: row, error } = await supabase
    .from("dochazka_zakazky")
    .select(
      "id, zakazka_id, user_id, checkin_at, checkout_at, claimed_duration_minutes, approval_status"
    )
    .eq("id", attendanceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("Docházka nebyla nalezena.");
  if (!row.checkout_at) throw new Error("Nelze schválit neukončenou docházku.");

  const hourlyRate = await loadHourlyRate(supabase, row.user_id);
  const defaultMinutes = getClaimedMinutes(row);
  const approvedMinutes = Math.round(
    parseOptionalNumber(formData, "approved_duration_minutes") ?? defaultMinutes
  );
  if (approvedMinutes < 0) throw new Error("Uznaný čas musí být nezáporný.");

  const defaultAmount = defaultApprovedAmountFromMinutes(approvedMinutes, hourlyRate);
  const approvedAmount = Math.round(
    parseOptionalNumber(formData, "approved_amount_czk") ?? defaultAmount
  );
  if (approvedAmount < 0) throw new Error("Uznaná částka musí být nezáporná.");

  const correctionNote = text(formData, "correction_note") || null;
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("dochazka_zakazky")
    .update({
      approval_status: "schvaleno",
      approved_duration_minutes: approvedMinutes,
      approved_amount_czk: approvedAmount,
      correction_note: correctionNote,
      approved_by: user.id,
      approved_at: now,
      payment_status: "ceka_na_proplaceni",
      updated_at: now,
    })
    .eq("id", attendanceId);

  if (updateError) throw new Error(updateError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId: row.zakazka_id,
    eventType: "attendance_approved",
    actorId: user.id,
    title: "Část práce byla schválena.",
    detail: `${approvedMinutes} min · ${formatMoneyCzk(approvedAmount)}`,
    metadata: { attendance_id: attendanceId, target_user_id: row.user_id },
  });

  await createNotification(supabase, {
    userId: row.user_id,
    type: "attendance_approved",
    priority: "info",
    title: "Práce byla schválena",
    message: formatMoneyCzk(approvedAmount),
    relatedZakazkaId: row.zakazka_id,
    actionUrl: "/moje",
    dedupeKey: `attendance-approved:${attendanceId}`,
  });

  revalidatePayoutPaths(row.zakazka_id);
}

export async function rejectAttendanceIntervalAction(formData: FormData) {
  const attendanceId = text(formData, "attendance_id");
  const note = text(formData, "correction_note");
  if (!attendanceId) throw new Error("Chybí ID docházky.");
  if (!note) throw new Error("U zamítnutí je povinná poznámka.");

  const { supabase, user } = await requirePaymentManager();
  const { data: row, error } = await supabase
    .from("dochazka_zakazky")
    .select("id, zakazka_id, user_id")
    .eq("id", attendanceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("Docházka nebyla nalezena.");

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("dochazka_zakazky")
    .update({
      approval_status: "zamitneto",
      approved_duration_minutes: null,
      approved_amount_czk: null,
      correction_note: note,
      approved_by: user.id,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", attendanceId);

  if (updateError) throw new Error(updateError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId: row.zakazka_id,
    eventType: "attendance_rejected",
    actorId: user.id,
    title: "Část práce byla zamítnuta.",
    detail: note,
    metadata: { attendance_id: attendanceId, target_user_id: row.user_id },
  });

  await createNotification(supabase, {
    userId: row.user_id,
    type: "attendance_rejected",
    priority: "warning",
    title: "Práce byla zamítnuta",
    message: note,
    relatedZakazkaId: row.zakazka_id,
    actionUrl: "/moje",
    dedupeKey: `attendance-rejected:${attendanceId}`,
  });

  revalidatePayoutPaths(row.zakazka_id);
}

export async function approveTravelClaimAction(formData: FormData) {
  const travelId = text(formData, "travel_id");
  if (!travelId) throw new Error("Chybí ID cestovní náhrady.");

  const { supabase, user } = await requirePaymentManager();
  const { data: row, error } = await supabase
    .from("cestovni_nahrady")
    .select(
      "id, zakazka_id, user_id, km, claimed_km, claimed_amount_czk, doprava_rezim, sazba_za_km, spotreba_l_100km, cena_paliva_kc_l"
    )
    .eq("id", travelId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("Cestovní náhrada nebyla nalezena.");

  const defaultKm = getTravelClaimedKm(row);
  const approvedKm = parseOptionalNumber(formData, "approved_km") ?? defaultKm;
  if (approvedKm < 0) throw new Error("Uznané km musí být nezáporné.");

  const defaultAmount = getTravelClaimedAmount(row);
  const approvedAmount = Math.round(parseOptionalNumber(formData, "approved_amount_czk") ?? defaultAmount);
  if (approvedAmount < 0) throw new Error("Uznaná částka musí být nezáporná.");

  const correctionNote = text(formData, "correction_note") || null;
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("cestovni_nahrady")
    .update({
      approval_status: "schvaleno",
      status: "schvaleno",
      approved_km: approvedKm,
      approved_amount_czk: approvedAmount,
      correction_note: correctionNote,
      rejected_reason: null,
      approved_by: user.id,
      approved_at: now,
      payment_status: "ceka_na_proplaceni",
      updated_at: now,
    })
    .eq("id", travelId);

  if (updateError) throw new Error(updateError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId: row.zakazka_id,
    eventType: "travel_reimbursement_approved",
    actorId: user.id,
    title: "Cestovní náhrada byla schválena.",
    detail: formatMoneyCzk(approvedAmount),
    metadata: { travel_id: travelId, target_user_id: row.user_id },
  });

  await createNotification(supabase, {
    userId: row.user_id,
    type: "travel_reimbursement_approved",
    priority: "info",
    title: "Cestovní náhrada byla schválena",
    message: formatMoneyCzk(approvedAmount),
    relatedZakazkaId: row.zakazka_id,
    actionUrl: "/moje",
    dedupeKey: `travel-approved:${travelId}`,
  });

  revalidatePayoutPaths(row.zakazka_id);
}

export async function rejectTravelClaimAction(formData: FormData) {
  const travelId = text(formData, "travel_id");
  const note = text(formData, "correction_note") || text(formData, "rejected_reason");
  if (!travelId) throw new Error("Chybí ID cestovní náhrady.");
  if (!note) throw new Error("U zamítnutí je povinná poznámka.");

  const { supabase, user } = await requirePaymentManager();
  const { data: row, error } = await supabase
    .from("cestovni_nahrady")
    .select("id, zakazka_id, user_id")
    .eq("id", travelId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("Cestovní náhrada nebyla nalezena.");

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("cestovni_nahrady")
    .update({
      approval_status: "zamitneto",
      status: "zamitneto",
      approved_km: null,
      approved_amount_czk: null,
      correction_note: note,
      rejected_reason: note,
      payment_status: "ceka_na_proplaceni",
      updated_at: now,
    })
    .eq("id", travelId);

  if (updateError) throw new Error(updateError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId: row.zakazka_id,
    eventType: "travel_reimbursement_rejected",
    actorId: user.id,
    title: "Cestovní náhrada byla zamítnuta.",
    detail: note,
    metadata: { travel_id: travelId, target_user_id: row.user_id },
  });

  await createNotification(supabase, {
    userId: row.user_id,
    type: "travel_reimbursement_rejected",
    priority: "warning",
    title: "Cestovní náhrada byla zamítnuta",
    message: note,
    relatedZakazkaId: row.zakazka_id,
    actionUrl: "/moje",
    dedupeKey: `travel-rejected:${travelId}`,
  });

  revalidatePayoutPaths(row.zakazka_id);
}

export async function markZakazkaEmployeePayoutAction(formData: FormData) {
  const zakazkaId = text(formData, "zakazka_id");
  const employeeUserId = text(formData, "user_id");
  if (!zakazkaId || !employeeUserId) throw new Error("Chybí zakázka nebo zaměstnanec.");

  const { supabase, user } = await requirePaymentManager();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("bank_account_number, bank_code, iban")
    .eq("user_id", employeeUserId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  const { data: workRows, error: workError } = await supabase
    .from("dochazka_zakazky")
    .select(
      "id, zakazka_id, user_id, typ_faze, checkin_at, checkout_at, approval_status, payment_status, approved_amount_czk"
    )
    .eq("zakazka_id", zakazkaId)
    .eq("user_id", employeeUserId);

  if (workError) throw new Error(workError.message);

  const { data: travelRows, error: travelError } = await supabase
    .from("cestovni_nahrady")
    .select("id, zakazka_id, user_id, approval_status, payment_status, approved_amount_czk")
    .eq("zakazka_id", zakazkaId)
    .eq("user_id", employeeUserId);

  if (travelError) throw new Error(travelError.message);

  const state = getPayoutGroupState({
    workRows: workRows ?? [],
    travelRows: travelRows ?? [],
    bankProfile: profile,
  });

  if (!state.canShowPayout) {
    throw new Error(
      "Proplacení lze označit až po vyřešení všech uzavřených položek a při existenci schválené částky k výplatě."
    );
  }

  const paidAt = new Date().toISOString();
  const workIds = state.payableWork.map((row) => row.id);
  const travelIds = state.payableTravel.map((row) => row.id);

  if (workIds.length > 0) {
    const { error } = await supabase
      .from("dochazka_zakazky")
      .update({
        payment_status: "proplaceno",
        paid_at: paidAt,
        paid_by: user.id,
        updated_at: paidAt,
      })
      .in("id", workIds);

    if (error) throw new Error(error.message);
  }

  if (travelIds.length > 0) {
    const { error } = await supabase
      .from("cestovni_nahrady")
      .update({
        payment_status: "proplaceno",
        status: "proplaceno",
        paid_at: paidAt,
        paid_by: user.id,
        updated_at: paidAt,
      })
      .in("id", travelIds);

    if (error) throw new Error(error.message);
  }

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "employee_payout_marked",
    actorId: user.id,
    title: "Souhrnné proplacení zaměstnance na zakázce.",
    detail: formatMoneyCzk(state.total),
    metadata: {
      target_user_id: employeeUserId,
      work_count: workIds.length,
      travel_count: travelIds.length,
      amount_czk: state.total,
    },
  });

  await createNotification(supabase, {
    userId: employeeUserId,
    type: "employee_payout_marked",
    priority: "info",
    title: "Proplacení bylo zaznamenáno",
    message: formatMoneyCzk(state.total),
    relatedZakazkaId: zakazkaId,
    actionUrl: "/moje",
    dedupeKey: `employee-payout:${zakazkaId}:${employeeUserId}:${paidAt.slice(0, 10)}`,
  });

  revalidatePayoutPaths(zakazkaId);
}

/** @deprecated Použijte markZakazkaEmployeePayoutAction */
export async function markAttendancePaidAction(formData: FormData) {
  throw new Error("Proplacení probíhá jen ze souhrnu zaměstnance na zakázce.");
}

/** @deprecated Použijte approveTravelClaimAction */
export async function approveTravelReimbursementAction(formData: FormData) {
  return approveTravelClaimAction(formData);
}

/** @deprecated Použijte rejectTravelClaimAction */
export async function rejectTravelReimbursementAction(formData: FormData) {
  return rejectTravelClaimAction(formData);
}

/** @deprecated Použijte markZakazkaEmployeePayoutAction */
export async function markTravelReimbursementPaidAction(formData: FormData) {
  throw new Error("Proplacení probíhá jen ze souhrnu zaměstnance na zakázce.");
}
