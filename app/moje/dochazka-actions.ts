"use server";

import { revalidatePath } from "next/cache";
import { getPaymentAmount } from "@/lib/payments";
import {
  getAttendanceMinutes,
  getAttendancePhaseLabel,
  normalizeAttendancePhase,
  normalizeGpsNumber,
  type AttendanceGpsInput,
} from "@/lib/zakazka-attendance";
import type { AttendanceDopravaRezim } from "@/lib/transport";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { createClient } from "@/lib/supabase/server";

type AttendanceResult =
  | { ok: true; warning?: string | null }
  | { ok: false; error: string; needsOverride?: boolean; warning?: string | null };

function gpsWarning(gps?: AttendanceGpsInput | null) {
  return gps?.lat == null || gps?.lng == null ? "GPS nebyla dostupná" : null;
}

async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Pro docházku musíte být přihlášeni.");
  return { supabase, user };
}

async function loadOwnAssignment(supabase: any, assignmentId: string, userId: string) {
  const { data: assignment, error } = await supabase
    .from("zakazka_lide")
    .select("id, zakazka_id, user_id, typ_bloku, datum_od, datum_do")
    .eq("id", assignmentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!assignment) throw new Error("Přiřazení nebylo nalezeno.");

  const { data: zakazka, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, zrusena, workflow_stav")
    .eq("zakazka_id", assignment.zakazka_id)
    .maybeSingle();

  if (zakazkaError) throw new Error(zakazkaError.message);
  if (zakazka?.zrusena || zakazka?.workflow_stav === "zruseno") {
    throw new Error("Zakázka byla zrušena. Docházku už nelze měnit.");
  }

  return assignment;
}

function normalizeDopravaRezim(value?: string | null): AttendanceDopravaRezim | null {
  const raw = String(value ?? "").trim();
  if (raw === "firemni" || raw === "soukrome" || raw === "spolujizda" || raw === "bez_nahrady") {
    return raw;
  }
  return null;
}

export async function checkInAttendanceAction({
  assignmentId,
  gps,
  overrideReason,
  mode = "work",
  dopravaRezim,
}: {
  assignmentId: string;
  gps?: AttendanceGpsInput | null;
  overrideReason?: string | null;
  mode?: "work" | "prejezd";
  dopravaRezim?: string | null;
}): Promise<AttendanceResult> {
  try {
    const { supabase, user } = await getCurrentUser();
    const assignment = await loadOwnAssignment(supabase, assignmentId, user.id);
    const warning = gpsWarning(gps);
    const phase =
      mode === "prejezd" ? "prejezd" : normalizeAttendancePhase(assignment.typ_bloku);
    const rezim = mode === "prejezd" ? normalizeDopravaRezim(dopravaRezim) : null;
    if (mode === "prejezd" && !rezim) {
      return { ok: false, error: "U přejezdu vyberte režim dopravy." };
    }
    const trimmedOverride = String(overrideReason ?? "").trim();

    const { data: existingOpen, error: existingOpenError } = await supabase
      .from("dochazka_zakazky")
      .select("id, zakazka_id, typ_faze, checkin_at")
      .eq("user_id", user.id)
      .is("checkout_at", null)
      .limit(1)
      .maybeSingle();

    if (existingOpenError) throw new Error(existingOpenError.message);
    if (existingOpen && existingOpen.zakazka_id !== assignment.zakazka_id && !trimmedOverride) {
      return {
        ok: false,
        needsOverride: true,
        warning,
        error: "Jste už checked-in na jiné zakázce. Pro pokračování je povinný důvod override.",
      };
    }

    if (existingOpen && existingOpen.zakazka_id === assignment.zakazka_id) {
      return { ok: false, warning, error: "Na této zakázce už máte aktivní práci." };
    }

    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from("dochazka_zakazky").insert({
      zakazka_id: assignment.zakazka_id,
      assignment_id: String(assignment.id),
      user_id: user.id,
      typ_faze: phase,
      doprava_rezim: rezim,
      checkin_at: now,
      approval_status: "ceka_na_schvaleni",
      payment_status: "ceka_na_proplaceni",
      gps_checkin_lat: normalizeGpsNumber(gps?.lat),
      gps_checkin_lng: normalizeGpsNumber(gps?.lng),
      gps_accuracy: normalizeGpsNumber(gps?.accuracy),
      manual_override: Boolean(trimmedOverride),
      override_reason: trimmedOverride || null,
    });

    if (insertError) throw new Error(insertError.message);

    if (existingOpen && trimmedOverride) {
      await logZakazkaHistory(supabase, {
        zakazkaId: assignment.zakazka_id,
        eventType: "attendance_conflict_override",
        actorId: user.id,
        title: "Docházka spuštěna přes kolizi aktivního check-inu.",
        detail: trimmedOverride,
        metadata: {
          assignment_id: assignment.id,
          conflicting_attendance_id: existingOpen.id,
          conflicting_zakazka_id: existingOpen.zakazka_id,
        },
      });
    }

    await logZakazkaHistory(supabase, {
      zakazkaId: assignment.zakazka_id,
      eventType: "attendance_checkin",
      actorId: user.id,
      title: `Zahájena práce: ${getAttendancePhaseLabel(phase)}.`,
      detail: warning,
      metadata: {
        assignment_id: assignment.id,
        typ_faze: phase,
        gps_available: !warning,
        gps_accuracy: normalizeGpsNumber(gps?.accuracy),
      },
    });

    revalidatePath("/moje");
    revalidatePath("/admin/proplaceni");
    revalidatePath(`/moje/zakazky/${assignment.zakazka_id}`);
    revalidatePath(`/zakazky/${assignment.zakazka_id}`);
    return { ok: true, warning };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Docházku se nepodařilo zahájit." };
  }
}

export async function checkOutAttendanceAction({
  assignmentId,
  gps,
}: {
  assignmentId: string;
  gps?: AttendanceGpsInput | null;
}): Promise<AttendanceResult> {
  try {
    const { supabase, user } = await getCurrentUser();
    const assignment = await loadOwnAssignment(supabase, assignmentId, user.id);
    const warning = gpsWarning(gps);
    const now = new Date().toISOString();

    const { data: openAttendance, error: openError } = await supabase
      .from("dochazka_zakazky")
      .select("id, checkin_at")
      .eq("assignment_id", String(assignment.id))
      .eq("user_id", user.id)
      .is("checkout_at", null)
      .order("checkin_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openError) throw new Error(openError.message);
    if (!openAttendance) return { ok: false, warning, error: "Nemáte aktivní práci pro tuto fázi." };

    const { error: updateError } = await supabase
      .from("dochazka_zakazky")
      .update({
        checkout_at: now,
        gps_checkout_lat: normalizeGpsNumber(gps?.lat),
        gps_checkout_lng: normalizeGpsNumber(gps?.lng),
        gps_checkout_accuracy: normalizeGpsNumber(gps?.accuracy),
        updated_at: now,
      })
      .eq("id", openAttendance.id)
      .eq("user_id", user.id);

    if (updateError) throw new Error(updateError.message);

    const minutes = getAttendanceMinutes(openAttendance.checkin_at, now);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("hodinovy_naklad_akce")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);

    const hourlyRate = Number(profile?.hodinovy_naklad_akce ?? 0);
    const claimedAmount = getPaymentAmount(minutes, hourlyRate);

    const { error: claimUpdateError } = await supabase
      .from("dochazka_zakazky")
      .update({
        claimed_duration_minutes: minutes,
        claimed_amount_czk: claimedAmount,
        approval_status: "ceka_na_schvaleni",
        payment_status: "ceka_na_proplaceni",
        approved_duration_minutes: null,
        approved_amount_czk: null,
      })
      .eq("id", openAttendance.id);

    if (claimUpdateError) throw new Error(claimUpdateError.message);

    await logZakazkaHistory(supabase, {
      zakazkaId: assignment.zakazka_id,
      eventType: "attendance_checkout",
      actorId: user.id,
      title: `Ukončena práce: ${getAttendancePhaseLabel(assignment.typ_bloku)}.`,
      detail: warning,
      metadata: {
        assignment_id: assignment.id,
        attendance_id: openAttendance.id,
        worked_minutes: minutes,
        gps_available: !warning,
        gps_accuracy: normalizeGpsNumber(gps?.accuracy),
      },
    });

    revalidatePath("/moje");
    revalidatePath(`/moje/zakazky/${assignment.zakazka_id}`);
    revalidatePath(`/zakazky/${assignment.zakazka_id}`);
    return { ok: true, warning };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Docházku se nepodařilo ukončit." };
  }
}
