"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { DEFAULT_KM_RATE, getTransportTypeLabel, normalizeTransportType } from "@/lib/transport";
import { createNotificationsForRoles } from "@/lib/notifications";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function getNullableDateTime(formData: FormData, key: string) {
  const value = getString(formData, key);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Datum a čas dopravy nejsou platné.");
  return date.toISOString();
}

function getPositiveNumber(formData: FormData, key: string) {
  const value = getString(formData, key);
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Kilometry musí být kladné číslo.");
  return parsed;
}

function getNonNegativeNumber(formData: FormData, key: string, fallback?: number) {
  const value = getString(formData, key);
  if (!value) return fallback ?? null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Sazba za km musí být nezáporné číslo.");
  return parsed;
}

function overlaps(from?: string | null, to?: string | null, otherFrom?: string | null, otherTo?: string | null) {
  if (!from || !to || !otherFrom || !otherTo) return false;
  const aStart = new Date(from).getTime();
  const aEnd = new Date(to).getTime();
  const bStart = new Date(otherFrom).getTime();
  const bEnd = new Date(otherTo).getTime();
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false;
  return aStart <= bEnd && aEnd >= bStart;
}

async function getCurrentUser() {
  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Pro úpravu dopravy musíte být přihlášeni.");
  return { supabase, user };
}

async function collectTransportWarnings({
  supabase,
  excludeId,
  zakazkaId,
  vehicleId,
  userId,
  transportType,
  odjezdAt,
  prijezdAt,
}: {
  supabase: any;
  excludeId?: string | null;
  zakazkaId: string;
  vehicleId?: string | null;
  userId?: string | null;
  transportType: string;
  odjezdAt?: string | null;
  prijezdAt?: string | null;
}) {
  const warnings: string[] = [];
  if (!odjezdAt || !prijezdAt) return warnings;

  if (transportType === "firemni_auto" && vehicleId) {
    const { data, error } = await supabase
      .from("zakazka_doprava")
      .select("id, zakazka_id, odjezd_at, prijezd_at")
      .eq("vozidlo_id", vehicleId);

    if (error) throw new Error(error.message);
    const conflict = (data ?? []).find(
      (row: any) =>
        row.id !== excludeId &&
        row.zakazka_id !== zakazkaId &&
        overlaps(odjezdAt, prijezdAt, row.odjezd_at, row.prijezd_at)
    );
    if (conflict) warnings.push("Firemní auto je ve stejný čas přiřazené na jiné zakázce.");
  }

  if (userId && (transportType === "soukrome_auto" || transportType === "pouze_presun_cloveka")) {
    const { data: transports, error: transportsError } = await supabase
      .from("zakazka_doprava")
      .select("id, zakazka_id, odjezd_at, prijezd_at")
      .eq("user_id", userId);

    if (transportsError) throw new Error(transportsError.message);
    const transportConflict = (transports ?? []).find(
      (row: any) =>
        row.id !== excludeId &&
        row.zakazka_id !== zakazkaId &&
        overlaps(odjezdAt, prijezdAt, row.odjezd_at, row.prijezd_at)
    );
    if (transportConflict) warnings.push("Člověk má ve stejný čas jiný dopravní přesun.");

    const { data: assignments, error: assignmentsError } = await supabase
      .from("zakazka_lide")
      .select("id, zakazka_id, datum_od, datum_do")
      .eq("user_id", userId);

    if (assignmentsError) throw new Error(assignmentsError.message);
    const assignmentConflict = (assignments ?? []).find(
      (row: any) => row.zakazka_id !== zakazkaId && overlaps(odjezdAt, prijezdAt, row.datum_od, row.datum_do)
    );
    if (assignmentConflict) warnings.push("Člověk má ve stejný čas naplánovanou práci na jiné zakázce.");

    const minutes = (new Date(prijezdAt).getTime() - new Date(odjezdAt).getTime()) / 60000;
    if (Number.isFinite(minutes) && minutes > 0 && minutes < 15) {
      warnings.push("Přejezd je podezřele krátký. Zatím jde jen o časový placeholder warning.");
    }
  }

  return warnings;
}

function transportPayload(formData: FormData) {
  const zakazkaId = getString(formData, "zakazka_id");
  if (!zakazkaId) throw new Error("Chybí zakázka.");
  const typDopravy = normalizeTransportType(getString(formData, "typ_dopravy"));
  const odjezdAt = getNullableDateTime(formData, "odjezd_at");
  const prijezdAt = getNullableDateTime(formData, "prijezd_at");

  return {
    zakazkaId,
    data: {
      zakazka_id: zakazkaId,
      typ_dopravy: typDopravy,
      vozidlo_id: getNullableString(formData, "vozidlo_id"),
      user_id: getNullableString(formData, "user_id"),
      odjezd_at: odjezdAt,
      prijezd_at: prijezdAt,
      odkud: getNullableString(formData, "odkud"),
      kam: getNullableString(formData, "kam"),
      poznamka: getNullableString(formData, "poznamka"),
      override_reason: getNullableString(formData, "override_reason"),
      updated_at: new Date().toISOString(),
    },
  };
}

async function validateVehicleForTransport(supabase: any, data: {
  typ_dopravy: string;
  vozidlo_id?: string | null;
  user_id?: string | null;
}) {
  if (!data.vozidlo_id) return;

  const { data: vehicle, error } = await supabase
    .from("vozidla")
    .select("id, typ, vlastnik_user_id, aktivni")
    .eq("id", data.vozidlo_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!vehicle || vehicle.aktivni === false) throw new Error("Vybrané vozidlo není aktivní.");

  if (data.typ_dopravy === "firemni_auto" && vehicle.typ !== "firemni") {
    throw new Error("Pro firemní dopravu vyberte firemní vozidlo.");
  }

  if (data.typ_dopravy === "soukrome_auto") {
    if (vehicle.typ !== "soukrome") {
      throw new Error("Pro soukromé auto vyberte soukromé vozidlo zaměstnance, nebo nechte vozidlo prázdné.");
    }
    if (vehicle.vlastnik_user_id && data.user_id && vehicle.vlastnik_user_id !== data.user_id) {
      throw new Error("Soukromé vozidlo patří jinému zaměstnanci než vybraný člověk.");
    }
  }

  if (data.typ_dopravy === "pouze_presun_cloveka" && vehicle.typ === "firemni") {
    throw new Error("U typu pouze přesun člověka nevybírejte firemní vozidlo.");
  }
}

async function maybeCreateTravelReimbursement({
  supabase,
  userId,
  actorId,
  transportId,
  zakazkaId,
  formData,
}: {
  supabase: any;
  userId?: string | null;
  actorId: string;
  transportId?: string | null;
  zakazkaId: string;
  formData: FormData;
}) {
  const km = getPositiveNumber(formData, "km");
  if (!km) return;
  if (!userId) throw new Error("Pro cestovní náhradu musí být vybraný člověk.");

  const sazba = getNonNegativeNumber(formData, "sazba_za_km", DEFAULT_KM_RATE) ?? DEFAULT_KM_RATE;
  const { error } = await supabase.from("cestovni_nahrady").insert({
    zakazka_id: zakazkaId,
    user_id: userId,
    zakazka_doprava_id: transportId ?? null,
    km,
    sazba_za_km: sazba,
    odkud: getNullableString(formData, "odkud"),
    kam: getNullableString(formData, "kam"),
    poznamka: getNullableString(formData, "poznamka"),
  });

  if (error) throw new Error(error.message);

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "travel_reimbursement_submitted",
    actorId,
    title: "Zadána cestovní náhrada.",
    detail: `${km} km × ${sazba} Kč/km`,
    metadata: { transport_id: transportId, target_user_id: userId, km, sazba_za_km: sazba },
  });

  await createNotificationsForRoles(supabase, ["admin", "sef"], {
    type: "travel_reimbursement_pending",
    priority: "warning",
    title: "Cestovní náhrada čeká na schválení",
    message: `${km} km × ${sazba} Kč/km`,
    relatedZakazkaId: zakazkaId,
    actionUrl: "/admin/proplaceni",
    dedupeKeyPrefix: `travel-reimbursement-pending:${zakazkaId}:${userId}:${Date.now()}`,
  });
}

export async function addTransportAction(formData: FormData) {
  const { supabase, user } = await getCurrentUser();
  const { zakazkaId, data } = transportPayload(formData);
  await validateVehicleForTransport(supabase, data);
  const warnings = await collectTransportWarnings({
    supabase,
    zakazkaId,
    vehicleId: data.vozidlo_id,
    userId: data.user_id,
    transportType: data.typ_dopravy,
    odjezdAt: data.odjezd_at,
    prijezdAt: data.prijezd_at,
  });

  if (warnings.length > 0 && !data.override_reason) {
    throw new Error(`${warnings.join(" ")} Pro pokračování vyplňte důvod override.`);
  }

  const { data: inserted, error } = await supabase.from("zakazka_doprava").insert(data).select("id").single();
  if (error) throw new Error(error.message);

  if (warnings.length > 0) {
    await logZakazkaHistory(supabase, {
      zakazkaId,
      eventType: "transport_collision_override",
      actorId: user.id,
      title: "Kolize dopravy byla povolena přes override.",
      detail: data.override_reason,
      metadata: { warnings, transport_id: inserted.id },
    });
  }

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "transport_added",
    actorId: user.id,
    title: "Přidána doprava k zakázce.",
    detail: getTransportTypeLabel(data.typ_dopravy),
    metadata: { transport_id: inserted.id, ...data },
  });

  if (data.typ_dopravy === "soukrome_auto") {
    await maybeCreateTravelReimbursement({
      supabase,
      actorId: user.id,
      userId: data.user_id,
      transportId: inserted.id,
      zakazkaId,
      formData,
    });
  }

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/moje");
}

export async function updateTransportAction(formData: FormData) {
  const id = getString(formData, "id");
  if (!id) throw new Error("Chybí ID dopravy.");
  const { supabase, user } = await getCurrentUser();
  const { zakazkaId, data } = transportPayload(formData);
  await validateVehicleForTransport(supabase, data);
  const warnings = await collectTransportWarnings({
    supabase,
    excludeId: id,
    zakazkaId,
    vehicleId: data.vozidlo_id,
    userId: data.user_id,
    transportType: data.typ_dopravy,
    odjezdAt: data.odjezd_at,
    prijezdAt: data.prijezd_at,
  });

  if (warnings.length > 0 && !data.override_reason) {
    throw new Error(`${warnings.join(" ")} Pro pokračování vyplňte důvod override.`);
  }

  const { error } = await supabase.from("zakazka_doprava").update(data).eq("id", id);
  if (error) throw new Error(error.message);

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: warnings.length > 0 ? "transport_collision_override" : "transport_updated",
    actorId: user.id,
    title: warnings.length > 0 ? "Doprava upravena přes kolizní override." : "Doprava byla upravena.",
    detail: warnings.length > 0 ? data.override_reason : getTransportTypeLabel(data.typ_dopravy),
    metadata: { transport_id: id, warnings, ...data },
  });

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/moje");
}

export async function deleteTransportAction(formData: FormData) {
  const id = getString(formData, "id");
  const zakazkaId = getString(formData, "zakazka_id");
  if (!id || !zakazkaId) throw new Error("Chybí ID dopravy.");

  const { supabase, user } = await getCurrentUser();
  const { error } = await supabase.from("zakazka_doprava").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "transport_deleted",
    actorId: user.id,
    title: "Doprava byla odstraněna.",
    metadata: { transport_id: id },
  });

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/moje");
}
