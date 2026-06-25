import "server-only";

import { requireAppAdminOrSef } from "@/lib/auth/admin-access-server";
import {
  DEFAULT_PORTAL_SESTAVA_KATALOG,
  normalizePortalSestavaKatalog,
} from "@/lib/client-portal/sestava-konfigurator-katalog";
import type {
  PortalKonfiguratorKatalogRow,
  PortalSestavaKatalog,
} from "@/lib/client-portal/sestava-konfigurator-types";
import { createAdminClient } from "@/lib/supabase/admin";

const KATALOG_KOD = "default";

export type PortalKonfiguratorAdminOptions = {
  setupy: Array<{ setup_id: string; nazev: string; oblast: string }>;
  skladPolozky: Array<{ skladova_polozka_id: string; nazev: string }>;
};

async function assertAdminAccess() {
  await requireAppAdminOrSef();
}

export async function loadPortalKonfiguratorKatalogAdmin(): Promise<PortalKonfiguratorKatalogRow> {
  await assertAdminAccess();

  const admin = createAdminClient();
  const { data } = await admin
    .from("portal_konfigurator_katalog")
    .select("katalog_id, kod, verze, obsah, aktivni, updated_at")
    .eq("kod", KATALOG_KOD)
    .maybeSingle();

  if (!data?.obsah) {
    return {
      katalog_id: null,
      kod: KATALOG_KOD,
      verze: 1,
      aktivni: true,
      updated_at: null,
      obsah: normalizePortalSestavaKatalog(DEFAULT_PORTAL_SESTAVA_KATALOG),
      from_db: false,
    };
  }

  return {
    katalog_id: data.katalog_id,
    kod: data.kod,
    verze: data.verze,
    aktivni: data.aktivni,
    updated_at: data.updated_at,
    obsah: normalizePortalSestavaKatalog(data.obsah as PortalSestavaKatalog),
    from_db: true,
  };
}

export async function loadPortalKonfiguratorAdminOptions(): Promise<PortalKonfiguratorAdminOptions> {
  await assertAdminAccess();

  const admin = createAdminClient();
  const [{ data: setupy }, { data: skladPolozky }] = await Promise.all([
    admin
      .from("setupy")
      .select("setup_id, nazev, oblast")
      .eq("aktivni", true)
      .order("poradi", { ascending: true })
      .order("nazev", { ascending: true }),
    admin
      .from("skladove_polozky")
      .select("skladova_polozka_id, nazev")
      .order("nazev", { ascending: true })
      .limit(500),
  ]);

  return {
    setupy: (setupy ?? []).map((row) => ({
      setup_id: row.setup_id,
      nazev: row.nazev,
      oblast: row.oblast,
    })),
    skladPolozky: (skladPolozky ?? []).map((row) => ({
      skladova_polozka_id: row.skladova_polozka_id,
      nazev: row.nazev,
    })),
  };
}

export async function savePortalKonfiguratorKatalogAdmin(input: {
  obsah: PortalSestavaKatalog;
  aktivni: boolean;
}) {
  await assertAdminAccess();

  const obsah = normalizePortalSestavaKatalog(input.obsah);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("portal_konfigurator_katalog")
    .select("katalog_id, verze")
    .eq("kod", KATALOG_KOD)
    .maybeSingle();

  if (existing?.katalog_id) {
    const { error } = await admin
      .from("portal_konfigurator_katalog")
      .update({
        obsah,
        aktivni: input.aktivni,
        verze: Number(existing.verze ?? 1) + 1,
        updated_at: now,
      })
      .eq("katalog_id", existing.katalog_id);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from("portal_konfigurator_katalog").insert({
    kod: KATALOG_KOD,
    obsah,
    aktivni: input.aktivni,
    verze: 1,
    updated_at: now,
  });

  if (error) throw new Error(error.message);
}

export async function resetPortalKonfiguratorKatalogAdmin() {
  await assertAdminAccess();
  await savePortalKonfiguratorKatalogAdmin({
    obsah: DEFAULT_PORTAL_SESTAVA_KATALOG,
    aktivni: true,
  });
}
