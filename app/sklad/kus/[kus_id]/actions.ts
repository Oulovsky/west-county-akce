"use server";

import { revalidatePath } from "next/cache";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { insertSkladKusHistorie } from "@/lib/sklad/kusHistorie";
import type { SkladKusHistorieTypAkce } from "@/lib/sklad/types";
import { createClient } from "@/lib/supabase/server";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";
import { createNotificationsForRoles } from "@/lib/notifications";

type ServiceAction = "damage" | "block" | "repair" | "return_service" | "checked" | "retire";

function requiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} je povinné.`);
  return value;
}

function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function optionalNumber(formData: FormData, key: string, label: string) {
  const value = optionalText(formData, key);
  if (value == null) return null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} musí být číslo 0 nebo vyšší.`);
  }
  return parsed;
}

function getActionConfig(action: ServiceAction): {
  stav: string;
  aktivni?: boolean;
  historyType: SkladKusHistorieTypAkce;
  defaultNote: string;
} {
  if (action === "damage") {
    return { stav: "poskozeno", historyType: "poskozeno", defaultNote: "Kus označen jako poškozený." };
  }
  if (action === "block") {
    return { stav: "blokovano", historyType: "blokovano", defaultNote: "Kus označen jako blokovaný." };
  }
  if (action === "repair") {
    return { stav: "v_oprave", historyType: "v_oprave", defaultNote: "Kus poslán do opravy." };
  }
  if (action === "return_service") {
    return {
      stav: "ceka_na_kontrolu",
      historyType: "ceka_na_kontrolu",
      defaultNote: "Kus vrácen ze servisu a čeká na kontrolu.",
    };
  }
  if (action === "retire") {
    return { stav: "vyrazeno", aktivni: false, historyType: "vyrazeno", defaultNote: "Kus vyřazen." };
  }
  return { stav: "skladem", aktivni: true, historyType: "zkontrolovano", defaultNote: "Kus zkontrolován a vrácen do provozu." };
}

export async function updateSkladKusServiceStateAction(formData: FormData) {
  const kusId = requiredText(formData, "kus_id", "ID kusu");
  const action = requiredText(formData, "action", "Akce") as ServiceAction;
  if (!["damage", "block", "repair", "return_service", "checked", "retire"].includes(action)) {
    throw new Error("Neplatná servisní akce.");
  }
  const note = optionalText(formData, "note");
  const config = getActionConfig(action);
  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const patch: Record<string, string | boolean | null> = {
    stav: config.stav,
    servisni_poznamka: note,
    servisni_stav_changed_at: new Date().toISOString(),
    servisni_stav_changed_by: user?.id ?? null,
  };
  if (typeof config.aktivni === "boolean") patch.aktivni = config.aktivni;

  const { data: kus, error: updateError } = await supabase
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .update(patch)
    .eq("kus_id", kusId)
    .select("kus_id, skladova_polozka_id")
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);
  if (!kus) throw new Error("Kus nebyl nalezen.");

  if (action === "checked") {
    const { error: closeDamageError } = await supabase
      .from(SKLAD_TABLE.hlaseniPoskozeni)
      .update({
        blokuje_pouziti: false,
        stav_reseni: "uzavreno",
        datum_uzavreni: new Date().toISOString(),
      })
      .eq("kus_id", kusId)
      .is("datum_uzavreni", null);

    if (closeDamageError) throw new Error(closeDamageError.message);
  }

  await insertSkladKusHistorie(supabase, {
    kusId,
    typAkce: config.historyType,
    poznamka: note ? `${config.defaultNote} ${note}` : config.defaultNote,
  });

  if (["damage", "block", "repair", "return_service", "retire"].includes(action)) {
    await createNotificationsForRoles(supabase, ["admin", "sef", "skladnik"], {
      type: "stock_piece_problem",
      priority: action === "retire" || action === "block" ? "critical" : "warning",
      title: "Změna servisního stavu kusu",
      message: note ? `${config.defaultNote} ${note}` : config.defaultNote,
      relatedKusId: kusId,
      actionUrl: `/sklad/kus/${kusId}`,
      dedupeKeyPrefix: `stock-service:${kusId}:${config.stav}:${Date.now()}`,
    });
  }

  revalidatePath(`/sklad/kus/${kusId}`);
  revalidatePath(`/sklad/${kus.skladova_polozka_id}`);
  revalidatePath("/sklad/sprava");
  revalidatePath("/sklad/servis");
}

export async function updateSkladKusAssetValueAction(formData: FormData) {
  const kusId = requiredText(formData, "kus_id", "ID kusu");
  const purchaseValue = optionalNumber(formData, "porizovaci_hodnota", "Pořizovací hodnota");
  const purchaseDate = optionalText(formData, "datum_porizeni");
  const depreciationBandId = optionalText(formData, "odpisove_pasmo_id");
  const supabase = await createClient();

  const { data: kus, error } = await supabase
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .update({
      porizovaci_hodnota: purchaseValue,
      datum_porizeni: purchaseDate,
      odpisove_pasmo_id: depreciationBandId,
    })
    .eq("kus_id", kusId)
    .select("kus_id, skladova_polozka_id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!kus) throw new Error("Kus nebyl nalezen.");

  await insertSkladKusHistorie(supabase, {
    kusId,
    typAkce: "servisni_poznamka",
    poznamka: "Aktualizována interní hodnota kusu a odpisové údaje.",
  });

  revalidatePath(`/sklad/kus/${kusId}`);
  revalidatePath(`/sklad/${kus.skladova_polozka_id}`);
  revalidatePath("/sklad/sprava");
}

export async function reportSkladKusDamageAction(formData: FormData) {
  const kusId = requiredText(formData, "kus_id", "ID kusu");
  const skladovaPolozkaId = requiredText(formData, "skladova_polozka_id", "ID položky");
  const note = requiredText(formData, "note", "Popis poškození");
  const blocksUse = formData.get("blocks_use") === "true";
  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: damageError } = await supabase.from(SKLAD_TABLE.hlaseniPoskozeni).insert({
    skladova_polozka_id: skladovaPolozkaId,
    kus_id: kusId,
    pocet_kusu: 1,
    popis: note,
    typ_poskozeni: "jine",
    priorita: blocksUse ? "vysoka" : "stredni",
    blokuje_pouziti: blocksUse,
    stav_reseni: "otevrene",
  });

  if (damageError) throw new Error(damageError.message);

  const nextState = blocksUse ? "blokovano" : "poskozeno";
  const { error: kusError } = await supabase
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .update({
      stav: nextState,
      servisni_poznamka: note,
      servisni_stav_changed_at: new Date().toISOString(),
      servisni_stav_changed_by: user?.id ?? null,
    })
    .eq("kus_id", kusId);

  if (kusError) throw new Error(kusError.message);

  await insertSkladKusHistorie(supabase, {
    kusId,
    typAkce: blocksUse ? "blokovano" : "poskozeno",
    poznamka: blocksUse ? `Nahlášeno blokující poškození: ${note}` : `Nahlášeno poškození: ${note}`,
  });

  await createNotificationsForRoles(supabase, ["admin", "sef", "skladnik"], {
    type: "stock_piece_damage_reported",
    priority: blocksUse ? "critical" : "warning",
    title: "Nahlášen problémový kus",
    message: note,
    relatedKusId: kusId,
    actionUrl: `/sklad/kus/${kusId}`,
    dedupeKeyPrefix: `stock-damage:${kusId}:${Date.now()}`,
  });

  revalidatePath(`/sklad/kus/${kusId}`);
  revalidatePath(`/sklad/${skladovaPolozkaId}`);
  revalidatePath("/sklad/sprava");
  revalidatePath("/sklad/servis");
}
