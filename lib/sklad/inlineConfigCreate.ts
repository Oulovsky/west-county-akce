import type { SupabaseClient } from "@supabase/supabase-js";
import { SKLAD_RPC } from "@/lib/sklad/constants";
import {
  queryJednotkySkladuFull,
  queryKategorieTechnikyFull,
  queryPodkategorieTechnikyFull,
  querySkladBloky,
} from "@/lib/sklad/queries";
import type {
  SkladBlok,
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
} from "@/lib/sklad/types";

export type InlineConfigCreateResult =
  | { ok: true; value: string; nazev: string }
  | { ok: false; message: string };

function fail(message: string): InlineConfigCreateResult {
  return { ok: false, message };
}

function findByNazev<T extends { nazev: string }>(
  items: T[],
  nazev: string
): T | undefined {
  const trimmed = nazev.trim();
  return items.find((item) => item.nazev === trimmed);
}

export async function createInlineSkladBlok(
  client: SupabaseClient,
  nazev: string
): Promise<InlineConfigCreateResult> {
  const trimmed = nazev.trim();
  if (!trimmed) return fail("Název je povinný.");

  const { error } = await client.rpc(SKLAD_RPC.createSkladBlok, {
    p_nazev: trimmed,
  });

  if (error) return fail(error.message);

  const { data, error: fetchError } = await querySkladBloky(client);
  if (fetchError) return fail(fetchError.message);

  const created = findByNazev((data ?? []) as SkladBlok[], trimmed);
  if (!created) {
    return fail("Okruh byl vytvořen, ale nepodařilo se ho automaticky vybrat.");
  }

  return { ok: true, value: created.sklad_blok_id, nazev: created.nazev };
}

export async function createInlineKategorie(
  client: SupabaseClient,
  nazev: string,
  skladBlokId: string
): Promise<InlineConfigCreateResult> {
  const trimmed = nazev.trim();
  if (!trimmed) return fail("Název je povinný.");
  if (!skladBlokId) return fail("Nejdřív vyber okruh.");

  const { error } = await client.rpc(SKLAD_RPC.createKategorieTechniky, {
    p_nazev: trimmed,
    p_sklad_blok_id: skladBlokId,
  });

  if (error) return fail(error.message);

  const { data, error: fetchError } = await queryKategorieTechnikyFull(client);
  if (fetchError) return fail(fetchError.message);

  const rows = (data ?? []) as SkladKategorie[];
  const created =
    findByNazev(
      rows.filter((row) => row.sklad_blok_id === skladBlokId),
      trimmed
    ) ?? findByNazev(rows, trimmed);

  if (!created) {
    return fail("Kategorie byla vytvořena, ale nepodařilo se ji automaticky vybrat.");
  }

  return { ok: true, value: created.kategorie_techniky_id, nazev: created.nazev };
}

export async function createInlinePodkategorie(
  client: SupabaseClient,
  nazev: string,
  kategorieTechnikyId: string
): Promise<InlineConfigCreateResult> {
  const trimmed = nazev.trim();
  if (!trimmed) return fail("Název je povinný.");
  if (!kategorieTechnikyId) return fail("Nejdřív vyber kategorii.");

  const { error } = await client.rpc(SKLAD_RPC.createPodkategorieTechniky, {
    p_kategorie_techniky_id: kategorieTechnikyId,
    p_nazev: trimmed,
  });

  if (error) return fail(error.message);

  const { data, error: fetchError } = await queryPodkategorieTechnikyFull(client);
  if (fetchError) return fail(fetchError.message);

  const rows = (data ?? []) as SkladPodkategorie[];
  const created =
    findByNazev(
      rows.filter((row) => row.kategorie_techniky_id === kategorieTechnikyId),
      trimmed
    ) ?? findByNazev(rows, trimmed);

  if (!created) {
    return fail("Podkategorie byla vytvořena, ale nepodařilo se ji automaticky vybrat.");
  }

  return {
    ok: true,
    value: created.podkategorie_techniky_id,
    nazev: created.nazev,
  };
}

export async function createInlineJednotka(
  client: SupabaseClient,
  nazev: string
): Promise<InlineConfigCreateResult> {
  const trimmed = nazev.trim();
  if (!trimmed) return fail("Název je povinný.");

  const { error } = await client.rpc(SKLAD_RPC.createJednotkaSkladu, {
    p_nazev: trimmed,
  });

  if (error) return fail(error.message);

  const { data, error: fetchError } = await queryJednotkySkladuFull(client);
  if (fetchError) return fail(fetchError.message);

  const created = findByNazev((data ?? []) as SkladJednotka[], trimmed);
  if (!created) {
    return fail("Jednotka byla vytvořena, ale nepodařilo se ji automaticky vybrat.");
  }

  return { ok: true, value: created.nazev, nazev: created.nazev };
}
