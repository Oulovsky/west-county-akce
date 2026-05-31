"use server";

import { revalidatePath } from "next/cache";
import { createNotificationsForRoles } from "@/lib/notifications";
import { DEFAULT_KM_RATE } from "@/lib/transport";
import {
  getAttendanceMinutes,
  getAttendancePhaseLabel,
  isPrepravaTypBloku,
  normalizeAttendancePhase,
  normalizeGpsNumber,
  normalizeTransportVehicleMode,
  type AttendanceGpsInput,
  type TransportVehicleMode,
} from "@/lib/zakazka-attendance";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { createClient } from "@/lib/supabase/server";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";

type AttendanceResult =
  | { ok: true; warning?: string | null }
  | { ok: false; error: string; needsOverride?: boolean; warning?: string | null };

function gpsWarning(gps?: AttendanceGpsInput | null) {
  return gps?.lat == null || gps?.lng == null ? "GPS nebyla dostupná" : null;
}

async function getCurrentUser() {
  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);
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

function normalizeAssignmentConfirmation(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "accepted" ? "accepted" : raw === "declined" ? "declined" : "pending";
}

async function loadZakazkaTransportAccess(supabase: any, zakazkaId: string, userId: string) {
  const { data: zakazka, error: zakazkaError } = await supabase
    .from("zakazky")
    .select("zakazka_id, zrusena, workflow_stav")
    .eq("zakazka_id", zakazkaId)
    .maybeSingle();

  if (zakazkaError) throw new Error(zakazkaError.message);
  if (!zakazka) throw new Error("Zakázka nebyla nalezena.");
  if (zakazka.zrusena || zakazka.workflow_stav === "zruseno") {
    throw new Error("Zakázka byla zrušena. Přepravu už nelze měnit.");
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("zakazka_lide")
    .select("id, typ_bloku, confirmation_status")
    .eq("zakazka_id", zakazkaId)
    .eq("user_id", userId);

  if (assignmentsError) throw new Error(assignmentsError.message);

  const regularAssignments = (assignments ?? []).filter(
    (row: { typ_bloku?: string | null }) => !isPrepravaTypBloku(row.typ_bloku)
  );

  if (regularAssignments.length === 0) {
    throw new Error("K přepravě musíte být na zakázce přiřazeni alespoň jednou běžnou fází práce.");
  }

  const hasAcceptedAssignment = regularAssignments.some(
    (row: { confirmation_status?: string | null }) =>
      normalizeAssignmentConfirmation(row.confirmation_status) === "accepted"
  );

  const linkAssignment =
    regularAssignments.find(
      (row: { confirmation_status?: string | null }) =>
        normalizeAssignmentConfirmation(row.confirmation_status) === "accepted"
    ) ?? regularAssignments[0];

  return {
    zakazkaId,
    linkAssignmentId: linkAssignment?.id != null ? String(linkAssignment.id) : null,
    hasAcceptedAssignment,
  };
}

async function validateTransportVehicle(
  supabase: any,
  mode: TransportVehicleMode,
  vozidloId: string | null,
  userId: string
) {
  if (!vozidloId) return;

  const { data: vehicle, error } = await supabase
    .from("vozidla")
    .select("id, typ, vlastnik_user_id, aktivni")
    .eq("id", vozidloId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!vehicle || vehicle.aktivni === false) throw new Error("Vybrané vozidlo není aktivní.");

  if (mode === "firemni" && vehicle.typ !== "firemni") {
    throw new Error("Pro firemní přepravu vyberte firemní vozidlo.");
  }

  if (mode === "vlastni") {
    if (vehicle.typ !== "soukrome") {
      throw new Error("Pro vlastní auto vyberte soukromé vozidlo, nebo nechte vozidlo prázdné.");
    }
    if (vehicle.vlastnik_user_id && vehicle.vlastnik_user_id !== userId) {
      throw new Error("Soukromé vozidlo patří jinému zaměstnanci.");
    }
  }
}

export async function checkInAttendanceAction({
  assignmentId,
  gps,
  overrideReason,
}: {
  assignmentId: string;
  gps?: AttendanceGpsInput | null;
  overrideReason?: string | null;
}): Promise<AttendanceResult> {
  try {
    const { supabase, user } = await getCurrentUser();
    const assignment = await loadOwnAssignment(supabase, assignmentId, user.id);
    const warning = gpsWarning(gps);
    const phase = normalizeAttendancePhase(assignment.typ_bloku);
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
      checkin_at: now,
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
      .select("id, checkin_at, typ_faze")
      .eq("assignment_id", String(assignment.id))
      .eq("user_id", user.id)
      .is("checkout_at", null)
      .order("checkin_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openError) throw new Error(openError.message);
    if (!openAttendance) return { ok: false, warning, error: "Nemáte aktivní práci pro tuto fázi." };
    if (openAttendance.typ_faze === "preprava") {
      return { ok: false, warning, error: "Pro ukončení přepravy použijte ovládání přepravy." };
    }

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
    const { error: approvedUpdateError } = await supabase
      .from("dochazka_zakazky")
      .update({
        approved_duration_minutes: minutes,
        payment_status: "ceka_na_proplaceni",
      })
      .eq("id", openAttendance.id)
      .is("approved_duration_minutes", null);

    if (approvedUpdateError) throw new Error(approvedUpdateError.message);

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

export async function checkInTransportAttendanceAction({
  zakazkaId,
  gps,
  vehicleMode,
  vozidloId,
  overrideReason,
}: {
  zakazkaId: string;
  gps?: AttendanceGpsInput | null;
  vehicleMode: string;
  vozidloId?: string | null;
  overrideReason?: string | null;
}): Promise<AttendanceResult> {
  try {
    const { supabase, user } = await getCurrentUser();
    const access = await loadZakazkaTransportAccess(supabase, zakazkaId, user.id);
    if (!access.hasAcceptedAssignment) {
      return { ok: false, error: "Přepravu můžete zahájit až po potvrzení zakázky." };
    }

    const mode = normalizeTransportVehicleMode(vehicleMode);
    if (!mode) return { ok: false, error: "Vyberte firemní nebo vlastní vozidlo." };

    const trimmedVehicleId = String(vozidloId ?? "").trim() || null;
    await validateTransportVehicle(supabase, mode, trimmedVehicleId, user.id);

    const warning = gpsWarning(gps);
    const trimmedOverride = String(overrideReason ?? "").trim();

    const { data: openTransportHere, error: openTransportError } = await supabase
      .from("dochazka_zakazky")
      .select("id")
      .eq("user_id", user.id)
      .eq("zakazka_id", zakazkaId)
      .eq("typ_faze", "preprava")
      .is("checkout_at", null)
      .maybeSingle();

    if (openTransportError) throw new Error(openTransportError.message);
    if (openTransportHere) {
      return { ok: false, warning, error: "Na této zakázce už máte aktivní přepravu." };
    }

    const { data: existingOpenOther, error: existingOpenOtherError } = await supabase
      .from("dochazka_zakazky")
      .select("id, zakazka_id, typ_faze, checkin_at")
      .eq("user_id", user.id)
      .is("checkout_at", null)
      .neq("zakazka_id", zakazkaId)
      .limit(1)
      .maybeSingle();

    if (existingOpenOtherError) throw new Error(existingOpenOtherError.message);
    if (existingOpenOther && !trimmedOverride) {
      return {
        ok: false,
        needsOverride: true,
        warning,
        error: "Máte aktivní docházku na jiné zakázce. Pro pokračování je povinný důvod override.",
      };
    }

    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from("dochazka_zakazky").insert({
      zakazka_id: zakazkaId,
      assignment_id: access.linkAssignmentId,
      user_id: user.id,
      typ_faze: "preprava",
      transport_vehicle_mode: mode,
      vozidlo_id: trimmedVehicleId,
      checkin_at: now,
      gps_checkin_lat: normalizeGpsNumber(gps?.lat),
      gps_checkin_lng: normalizeGpsNumber(gps?.lng),
      gps_accuracy: normalizeGpsNumber(gps?.accuracy),
      manual_override: Boolean(trimmedOverride),
      override_reason: trimmedOverride || null,
    });

    if (insertError) throw new Error(insertError.message);

    if (existingOpenOther && trimmedOverride) {
      await logZakazkaHistory(supabase, {
        zakazkaId,
        eventType: "attendance_conflict_override",
        actorId: user.id,
        title: "Přeprava spuštěna přes kolizi aktivního check-inu.",
        detail: trimmedOverride,
        metadata: {
          assignment_id: access.linkAssignmentId,
          conflicting_attendance_id: existingOpenOther.id,
          conflicting_zakazka_id: existingOpenOther.zakazka_id,
        },
      });
    }

    await logZakazkaHistory(supabase, {
      zakazkaId,
      eventType: "attendance_checkin",
      actorId: user.id,
      title: `Zahájena přeprava (${mode === "firemni" ? "firemní" : "vlastní"} vozidlo).`,
      detail: warning,
      metadata: {
        assignment_id: access.linkAssignmentId,
        typ_faze: "preprava",
        transport_vehicle_mode: mode,
        vozidlo_id: trimmedVehicleId,
        gps_available: !warning,
      },
    });

    revalidatePath("/moje");
    revalidatePath(`/moje/zakazky/${zakazkaId}`);
    revalidatePath(`/zakazky/${zakazkaId}`);
    revalidatePath("/admin/proplaceni");
    return { ok: true, warning };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Přepravu se nepodařilo zahájit.",
    };
  }
}

export async function checkOutTransportAttendanceAction({
  zakazkaId,
  gps,
  km,
}: {
  zakazkaId: string;
  gps?: AttendanceGpsInput | null;
  km?: number | string | null;
}): Promise<AttendanceResult> {
  try {
    const { supabase, user } = await getCurrentUser();
    await loadZakazkaTransportAccess(supabase, zakazkaId, user.id);

    const warning = gpsWarning(gps);
    const now = new Date().toISOString();

    const { data: openAttendance, error: openError } = await supabase
      .from("dochazka_zakazky")
      .select("id, checkin_at, typ_faze, transport_vehicle_mode, vozidlo_id, zakazka_id")
      .eq("zakazka_id", zakazkaId)
      .eq("user_id", user.id)
      .eq("typ_faze", "preprava")
      .is("checkout_at", null)
      .order("checkin_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openError) throw new Error(openError.message);
    if (!openAttendance) {
      return { ok: false, warning, error: "Nemáte aktivní přepravu na této zakázce." };
    }

    const mode = normalizeTransportVehicleMode(openAttendance.transport_vehicle_mode);
    if (!mode) return { ok: false, error: "Chybí režim vozidla u aktivní přepravy." };

    let parsedKm: number | null = null;
    if (mode === "vlastni") {
      const rawKm = String(km ?? "").trim().replace(",", ".");
      parsedKm = rawKm ? Number(rawKm) : NaN;
      if (!Number.isFinite(parsedKm) || parsedKm <= 0) {
        return { ok: false, warning, error: "U vlastního auta zadejte kladné kilometry." };
      }
    }

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
    const { error: approvedUpdateError } = await supabase
      .from("dochazka_zakazky")
      .update({
        approved_duration_minutes: minutes,
        payment_status: "ceka_na_proplaceni",
      })
      .eq("id", openAttendance.id)
      .is("approved_duration_minutes", null);

    if (approvedUpdateError) throw new Error(approvedUpdateError.message);

    if (mode === "vlastni" && parsedKm != null) {
      const { error: travelError } = await supabase.from("cestovni_nahrady").insert({
        zakazka_id: openAttendance.zakazka_id,
        user_id: user.id,
        km: parsedKm,
        sazba_za_km: DEFAULT_KM_RATE,
        poznamka: trimmedVehicleNote(openAttendance.vozidlo_id),
      });

      if (travelError) throw new Error(travelError.message);

      await logZakazkaHistory(supabase, {
        zakazkaId: openAttendance.zakazka_id,
        eventType: "travel_reimbursement_submitted",
        actorId: user.id,
        title: "Cestovní náhrada z přepravy (vlastní auto).",
        detail: `${parsedKm} km × ${DEFAULT_KM_RATE} Kč/km`,
        metadata: {
          attendance_id: openAttendance.id,
          km: parsedKm,
        },
      });

      await createNotificationsForRoles(supabase, ["admin", "sef"], {
        type: "travel_reimbursement_pending",
        priority: "warning",
        title: "Cestovní náhrada čeká na schválení",
        message: `${parsedKm} km × ${DEFAULT_KM_RATE} Kč/km (přeprava)`,
        relatedZakazkaId: openAttendance.zakazka_id,
        actionUrl: "/admin/proplaceni",
        dedupeKeyPrefix: `travel-reimbursement-preprava:${openAttendance.zakazka_id}:${user.id}:${Date.now()}`,
      });
    }

    await logZakazkaHistory(supabase, {
      zakazkaId,
      eventType: "attendance_checkout",
      actorId: user.id,
      title: `Ukončena přeprava (${mode === "firemni" ? "firemní" : "vlastní"} vozidlo).`,
      detail: warning,
      metadata: {
        attendance_id: openAttendance.id,
        worked_minutes: minutes,
        transport_vehicle_mode: mode,
        travel_km: parsedKm,
      },
    });

    revalidatePath("/moje");
    revalidatePath(`/moje/zakazky/${zakazkaId}`);
    revalidatePath(`/zakazky/${zakazkaId}`);
    revalidatePath("/admin/proplaceni");
    return { ok: true, warning };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Přepravu se nepodařilo ukončit.",
    };
  }
}

function trimmedVehicleNote(vozidloId?: string | null) {
  const id = String(vozidloId ?? "").trim();
  return id ? `Přeprava – vozidlo ${id}` : "Přeprava – vlastní vozidlo";
}
