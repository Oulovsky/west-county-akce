"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { calcFuelClaimAmount, normalizeTravelDopravaRezim } from "@/lib/transport";
import { createNotificationsForRoles } from "@/lib/notifications";
import { formatMoneyCzk } from "@/lib/payments";

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
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Pro zadání cestovní náhrady musíte být přihlášeni.");

  const zakazkaId = getString(formData, "zakazka_id");
  if (!zakazkaId) throw new Error("Chybí zakázka.");

  const dopravaRezim = normalizeTravelDopravaRezim(getString(formData, "doprava_rezim"));
  const km = getNumber(formData, "km");
  if (km == null || km < 0) throw new Error("Kilometry musí být nezáporné číslo.");
  if (dopravaRezim === "soukrome_auto" && km <= 0) {
    throw new Error("U soukromého vozidla zadejte kladné kilometry.");
  }

  const spotreba = getNumber(formData, "spotreba_l_100km");
  const cenaPaliva = getNumber(formData, "cena_paliva_kc_l");
  const sazba = getNumber(formData, "sazba_za_km", 0) ?? 0;

  let claimedAmount = 0;
  if (dopravaRezim === "soukrome_auto") {
    if (spotreba == null || spotreba <= 0 || cenaPaliva == null || cenaPaliva <= 0) {
      throw new Error("U soukromého vozidla vyplňte spotřebu a cenu paliva.");
    }
    claimedAmount = calcFuelClaimAmount(km, spotreba, cenaPaliva);
  }

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
    doprava_rezim: dopravaRezim,
    km,
    claimed_km: km,
    sazba_za_km: sazba,
    spotreba_l_100km: spotreba,
    cena_paliva_kc_l: cenaPaliva,
    claimed_amount_czk: claimedAmount,
    odkud: getNullableString(formData, "odkud"),
    kam: getNullableString(formData, "kam"),
    poznamka: getNullableString(formData, "poznamka"),
    approval_status: "ceka_na_schvaleni",
    payment_status: "ceka_na_proplaceni",
    status: "ceka_na_schvaleni",
  });

  if (insertError) throw new Error(insertError.message);

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "travel_reimbursement_submitted",
    actorId: user.id,
    title: "Zaměstnanec zadal cestovní náhradu.",
    detail: `${km} km · ${formatMoneyCzk(claimedAmount)}`,
    metadata: { transport_id: transportId, km, doprava_rezim: dopravaRezim, claimed_amount_czk: claimedAmount },
  });

  await createNotificationsForRoles(supabase, ["admin", "sef"], {
    type: "travel_reimbursement_pending",
    priority: "warning",
    title: "Cestovní náhrada čeká na schválení",
    message: `${km} km · ${formatMoneyCzk(claimedAmount)}`,
    relatedZakazkaId: zakazkaId,
    actionUrl: "/admin/proplaceni",
    dedupeKeyPrefix: `travel-reimbursement-pending:${zakazkaId}:${user.id}:${Date.now()}`,
  });

  revalidatePath("/moje");
  revalidatePath("/admin/proplaceni");
  revalidatePath(`/moje/zakazky/${zakazkaId}`);
  revalidatePath(`/zakazky/${zakazkaId}`);
}
