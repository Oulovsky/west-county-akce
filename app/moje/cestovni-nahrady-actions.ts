"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { DEFAULT_KM_RATE } from "@/lib/transport";
import { createNotificationsForRoles } from "@/lib/notifications";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function getNumber(formData: FormData, key: string, fallback?: number) {
  const value = getString(formData, key);
  if (!value) return fallback ?? null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error("Číslo není platné.");
  return parsed;
}

export async function submitTravelReimbursementAction(formData: FormData) {
  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Pro zadání cestovní náhrady musíte být přihlášeni.");

  const zakazkaId = getString(formData, "zakazka_id");
  if (!zakazkaId) throw new Error("Chybí zakázka.");

  const km = getNumber(formData, "km");
  if (km == null || km <= 0) throw new Error("Kilometry musí být kladné číslo.");

  const sazba = getNumber(formData, "sazba_za_km", DEFAULT_KM_RATE);
  if (sazba == null || sazba < 0) throw new Error("Sazba za km musí být nezáporná.");

  const transportId = getNullableString(formData, "zakazka_doprava_id");
  if (transportId) {
    const { data: transport, error: transportError } = await supabase
      .from("zakazka_doprava")
      .select("id, user_id, zakazka_id")
      .eq("id", transportId)
      .maybeSingle();

    if (transportError) throw new Error(transportError.message);
    if (!transport || transport.user_id !== user.id || transport.zakazka_id !== zakazkaId) {
      throw new Error("Dopravní záznam nepatří přihlášenému uživateli.");
    }
  }

  const { error: insertError } = await supabase.from("cestovni_nahrady").insert({
    zakazka_id: zakazkaId,
    user_id: user.id,
    zakazka_doprava_id: transportId,
    km,
    sazba_za_km: sazba,
    odkud: getNullableString(formData, "odkud"),
    kam: getNullableString(formData, "kam"),
    poznamka: getNullableString(formData, "poznamka"),
  });

  if (insertError) throw new Error(insertError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "travel_reimbursement_submitted",
    actorId: user.id,
    title: "Zaměstnanec zadal cestovní náhradu.",
    detail: `${km} km × ${sazba} Kč/km`,
    metadata: { transport_id: transportId, km, sazba_za_km: sazba },
  });

  await createNotificationsForRoles(supabase, ["admin", "sef"], {
    type: "travel_reimbursement_pending",
    priority: "warning",
    title: "Cestovní náhrada čeká na schválení",
    message: `${km} km × ${sazba} Kč/km`,
    relatedZakazkaId: zakazkaId,
    actionUrl: "/admin/proplaceni",
    dedupeKeyPrefix: `travel-reimbursement-pending:${zakazkaId}:${user.id}:${Date.now()}`,
  });

  revalidatePath("/moje");
  revalidatePath(`/moje/zakazky/${zakazkaId}`);
  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath("/admin/proplaceni");
}
