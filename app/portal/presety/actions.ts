"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import {
  createClientPlacePreset,
  createClientSetupPreset,
  createClientTechnicalPreset,
  deleteClientPlacePreset,
  deleteClientSetupPreset,
  deleteClientTechnicalPreset,
  updateClientPlacePreset,
} from "@/lib/client-portal/client-presets-server";
import { parseTechnikaJson } from "@/lib/client-portal/poptavka-technika-form";
import { parseSestavaFormData } from "@/lib/client-portal/sestava-konfigurator-form";
import { createClient } from "@/lib/supabase/server";

function redirectPresetyError(message: string): never {
  redirect(`/portal/presety?error=${encodeURIComponent(message)}`);
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalNumber(formData: FormData, key: string) {
  const raw = textValue(formData, key).replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function savePlacePresetAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const presetId = textValue(formData, "preset_id");
  const payload = {
    nazev: textValue(formData, "nazev"),
    adresa_text: textValue(formData, "adresa_text") || null,
    lat: optionalNumber(formData, "lat"),
    lng: optionalNumber(formData, "lng"),
    presny_popis_mista: textValue(formData, "presny_popis_mista") || null,
    poznamka_prijezd: textValue(formData, "poznamka_prijezd") || null,
    omezeni_vjezdu: textValue(formData, "omezeni_vjezdu") || null,
    poznamka_manipulace: textValue(formData, "poznamka_manipulace") || null,
    interni_poznamka_klienta: textValue(formData, "interni_poznamka_klienta") || null,
    source_poptavka_id: null,
    source_misto_id: null,
  };

  try {
    if (presetId) {
      await updateClientPlacePreset(supabase, presetId, payload);
    } else {
      await createClientPlacePreset(supabase, payload);
    }
  } catch (error) {
    redirectPresetyError(error instanceof Error ? error.message : "Uložení se nezdařilo.");
  }

  revalidatePath("/portal/presety");
  redirect("/portal/presety?saved=place");
}

export async function deletePlacePresetAction(presetId: string) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  try {
    await deleteClientPlacePreset(supabase, presetId);
  } catch (error) {
    redirectPresetyError(error instanceof Error ? error.message : "Smazání se nezdařilo.");
  }

  revalidatePath("/portal/presety");
  redirect("/portal/presety");
}

export async function saveTechnicalPresetAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const nazev = textValue(formData, "nazev");
  const technika = parseTechnikaJson(textValue(formData, "technicke_data_json"));
  if (!technika) {
    redirectPresetyError("Neplatná technická data presetu.");
  }

  try {
    await createClientTechnicalPreset(supabase, {
      nazev,
      technicke_data: technika,
    });
  } catch (error) {
    redirectPresetyError(error instanceof Error ? error.message : "Uložení se nezdařilo.");
  }

  revalidatePath("/portal/presety");
  redirect("/portal/presety?saved=technical");
}

export async function deleteTechnicalPresetAction(presetId: string) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  try {
    await deleteClientTechnicalPreset(supabase, presetId);
  } catch (error) {
    redirectPresetyError(error instanceof Error ? error.message : "Smazání se nezdařilo.");
  }

  revalidatePath("/portal/presety");
  redirect("/portal/presety");
}

export async function saveSetupPresetAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const nazev = textValue(formData, "nazev");
  const popis = textValue(formData, "popis") || null;
  const sestava = parseSestavaFormData(formData);
  const setupIds = formData.getAll("setup_id").map((value) => String(value));
  const setupy = setupIds
    .map((setupId, index) => {
      const mnozstvi = Number(textValue(formData, `setup_mnozstvi_${index}`) || "1");
      return {
        setup_id: setupId,
        mnozstvi: Number.isFinite(mnozstvi) ? Math.max(1, Math.floor(mnozstvi)) : 1,
        poznamka_klienta: textValue(formData, `setup_poznamka_${index}`) || null,
      };
    })
    .filter((row) => row.setup_id);

  try {
    await createClientSetupPreset(supabase, {
      nazev,
      sestava_konfigurator: sestava,
      setupy,
      popis,
    });
  } catch (error) {
    redirectPresetyError(error instanceof Error ? error.message : "Uložení se nezdařilo.");
  }

  revalidatePath("/portal/presety");
  redirect("/portal/presety?saved=setup");
}

export async function deleteSetupPresetAction(presetId: string) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  try {
    await deleteClientSetupPreset(supabase, presetId);
  } catch (error) {
    redirectPresetyError(error instanceof Error ? error.message : "Smazání se nezdařilo.");
  }

  revalidatePath("/portal/presety");
  redirect("/portal/presety");
}
