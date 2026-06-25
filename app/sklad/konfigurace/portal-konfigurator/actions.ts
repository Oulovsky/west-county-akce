"use server";

import { revalidatePath } from "next/cache";
import { normalizePortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-katalog";
import type { PortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-types";
import {
  resetPortalKonfiguratorKatalogAdmin,
  savePortalKonfiguratorKatalogAdmin,
} from "@/lib/sklad/portal-konfigurator-admin-server";

function parseKatalogJson(json: string): PortalSestavaKatalog {
  const parsed = JSON.parse(json) as PortalSestavaKatalog;
  return normalizePortalSestavaKatalog(parsed);
}

export async function savePortalKonfiguratorKatalogAction(formData: FormData) {
  const json = String(formData.get("obsah_json") ?? "").trim();
  const aktivni = String(formData.get("aktivni") ?? "true") === "true";

  if (!json) {
    return { ok: false as const, error: "Chybí obsah katalogu." };
  }

  try {
    const obsah = parseKatalogJson(json);
    await savePortalKonfiguratorKatalogAdmin({ obsah, aktivni });
    revalidatePath("/sklad/konfigurace/portal-konfigurator");
    return { ok: true as const, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Uložení se nezdařilo.";
    return { ok: false as const, error: message };
  }
}

export async function resetPortalKonfiguratorKatalogAction() {
  try {
    await resetPortalKonfiguratorKatalogAdmin();
    revalidatePath("/sklad/konfigurace/portal-konfigurator");
    return { ok: true as const, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Obnovení se nezdařilo.";
    return { ok: false as const, error: message };
  }
}
