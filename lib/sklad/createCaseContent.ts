import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SKLAD_RPC, SKLAD_TABLE } from "@/lib/sklad/constants";
import {
  CASE_NESTING_FORBIDDEN_MESSAGE,
  isCaseJednotka,
} from "@/lib/sklad/caseJednotka";
import {
  findMatchingCaseContentPolozka,
  markPolozkaAsCaseContent,
} from "@/lib/sklad/caseContentPolozka";
import { toNumber } from "@/lib/sklad/helpers";
import type { SkladPolozkaRow } from "@/lib/sklad/types";
import { insertKusIntoCase, loadKusWithPolozka } from "@/lib/sklad/kusObsah";
import { countActiveObsahForParent } from "@/lib/sklad/kusObsahRead";
import { recountPolozkaCelkemKDispozici } from "@/lib/sklad/recountPolozkaCelkem";
import { syncPolozkaKusyToCelkem } from "@/lib/sklad/syncPolozkaKusy";

export type CreateCaseContentInput = {
  parentKusId: string;
  nazev: string;
  skladBlokId: string;
  kategorieTechnikyId: string;
  podkategorieTechnikyId: string | null;
  jednotka: string;
  technickyVlastnikId: string;
  count: number;
  poznamka: string | null;
  userId?: string | null;
};

export type CreateCaseContentResult = {
  parentKusId: string;
  contentPolozkaId: string;
  createdKusCount: number;
  insertedKusIds: string[];
};

async function loadParentPolozkaJednotka(
  client: SupabaseClient,
  skladovaPolozkaId: string
): Promise<string | null> {
  const { data, error } = await client.rpc(SKLAD_RPC.getSkladovaPolozkaDetail, {
    p_skladova_polozka_id: skladovaPolozkaId,
  });

  if (error) throw new Error(error.message);
  const row = ((data ?? [])[0] ?? null) as { jednotka?: string | null } | null;
  return row?.jednotka ?? null;
}

export async function assertParentKusAllowsNesting(
  client: SupabaseClient,
  parentKusId: string
) {
  const parent = await loadKusWithPolozka(client, parentKusId);
  if (!parent) {
    throw new Error("Case (parent kus) neexistuje.");
  }

  const jednotka = await loadParentPolozkaJednotka(client, parent.skladova_polozka_id);
  if (!isCaseJednotka(jednotka)) {
    throw new Error(CASE_NESTING_FORBIDDEN_MESSAGE);
  }

  return parent;
}

async function createContentPolozka(
  client: SupabaseClient,
  input: {
    nazev: string;
    skladBlokId: string;
    kategorieTechnikyId: string;
    podkategorieTechnikyId: string | null;
    jednotka: string;
    technickyVlastnikId: string;
  }
): Promise<string> {
  const { data, error } = await client.rpc("create_skladova_polozka", {
    p_nazev: input.nazev.trim(),
    p_kategorie_techniky_id: input.kategorieTechnikyId,
    p_podkategorie_techniky_id: input.podkategorieTechnikyId,
    p_jednotka: input.jednotka.trim(),
    p_celkem_k_dispozici: 0,
    p_interni_naklad: null,
    p_fakturacni_cena: null,
    p_aktivni: true,
    p_poznamka: null,
  });

  if (error) throw new Error(error.message);

  const createdId = ((data ?? [])[0] as { skladova_polozka_id?: string } | undefined)
    ?.skladova_polozka_id;

  if (!createdId) {
    throw new Error("Nepodařilo se vytvořit skladovou položku obsahu.");
  }

  await markPolozkaAsCaseContent(client, createdId);

  const assignRes = await client.rpc(SKLAD_RPC.setSkladPolozkaBlok, {
    p_polozka_id: createdId,
    p_blok_id: input.skladBlokId,
  });

  if (assignRes.error) throw new Error(assignRes.error.message);

  const vlastnikRes = await client.rpc(SKLAD_RPC.updateSkladovaPolozkaVlastnik, {
    p_skladova_polozka_id: createdId,
    p_technicky_vlastnik_id: input.technickyVlastnikId,
  });

  if (vlastnikRes.error) throw new Error(vlastnikRes.error.message);

  return createdId;
}

export async function createCaseContent(
  client: SupabaseClient,
  input: CreateCaseContentInput
): Promise<CreateCaseContentResult> {
  const count = Math.floor(input.count);
  if (!Number.isFinite(count) || count < 1 || count > 200) {
    throw new Error("Počet kusů musí být celé číslo od 1 do 200.");
  }

  if (!input.nazev.trim()) throw new Error("Název položky je povinný.");
  if (!input.skladBlokId) throw new Error("Okruh je povinný.");
  if (!input.kategorieTechnikyId) throw new Error("Kategorie je povinná.");
  if (!input.jednotka.trim()) throw new Error("Jednotka je povinná.");
  if (!input.technickyVlastnikId) throw new Error("Vlastník je povinný.");

  const parent = await assertParentKusAllowsNesting(client, input.parentKusId);

  let contentPolozka = await findMatchingCaseContentPolozka(client, {
    nazev: input.nazev,
    skladBlokId: input.skladBlokId,
    kategorieTechnikyId: input.kategorieTechnikyId,
    podkategorieTechnikyId: input.podkategorieTechnikyId,
    jednotka: input.jednotka,
  });

  if (!contentPolozka) {
    const polozkaId = await createContentPolozka(client, {
      nazev: input.nazev,
      skladBlokId: input.skladBlokId,
      kategorieTechnikyId: input.kategorieTechnikyId,
      podkategorieTechnikyId: input.podkategorieTechnikyId,
      jednotka: input.jednotka,
      technickyVlastnikId: input.technickyVlastnikId,
    });
    contentPolozka = {
      skladova_polozka_id: polozkaId,
      nazev: input.nazev.trim(),
      celkem_k_dispozici: 0,
    } as SkladPolozkaRow;
  }

  const contentPolozkaId = contentPolozka.skladova_polozka_id;
  const polozkaNazev = contentPolozka.nazev.trim();

  const { data: existingKusy, error: kusyError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id, poradove_cislo")
    .eq("skladova_polozka_id", contentPolozkaId)
    .order("poradove_cislo", { ascending: true });

  if (kusyError) throw new Error(kusyError.message);

  const beforeCount = existingKusy?.length ?? 0;
  const maxPoradiBefore = (existingKusy ?? []).reduce(
    (max, row) => Math.max(max, toNumber(row.poradove_cislo)),
    0
  );

  const syncResult = await syncPolozkaKusyToCelkem(
    client,
    contentPolozkaId,
    polozkaNazev,
    beforeCount + count
  );

  if (!syncResult.ok) {
    throw new Error(syncResult.error ?? "Nepodařilo se vytvořit kusy obsahu.");
  }

  if (syncResult.created !== count) {
    throw new Error(
      `Očekáváno ${count} nových kusů, vytvořeno ${syncResult.created}. Zkontrolujte položku ${polozkaNazev}.`
    );
  }

  const { data: newKusyRaw, error: newKusyError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id")
    .eq("skladova_polozka_id", contentPolozkaId)
    .gt("poradove_cislo", maxPoradiBefore)
    .order("poradove_cislo", { ascending: true });

  if (newKusyError) throw new Error(newKusyError.message);

  const insertedKusIds = (newKusyRaw ?? []).map((row) => row.kus_id as string);
  if (insertedKusIds.length !== count) {
    throw new Error("Nepodařilo se načíst nově vytvořené kusy pro vložení do case.");
  }

  const obsahCountBefore = await countActiveObsahForParent(client, input.parentKusId);

  const linkedKusIds: string[] = [];
  for (const childKusId of insertedKusIds) {
    await insertKusIntoCase(client, {
      parentKusId: input.parentKusId,
      childKusId,
      poznamka: input.poznamka,
      userId: input.userId,
    });
    linkedKusIds.push(childKusId);
  }

  const obsahCountAfter = await countActiveObsahForParent(client, input.parentKusId);
  if (obsahCountAfter < obsahCountBefore + linkedKusIds.length) {
    throw new Error(
      `Vazby do case se nepodařilo uložit (v case je ${obsahCountAfter} kusů, očekáváno alespoň ${obsahCountBefore + linkedKusIds.length}).`
    );
  }

  const { data: verifyLinks, error: verifyError } = await client
    .from(SKLAD_TABLE.skladKusObsah)
    .select("child_kus_id")
    .eq("parent_kus_id", input.parentKusId)
    .in("child_kus_id", linkedKusIds)
    .is("vyjmuto_at", null);

  if (verifyError) throw new Error(verifyError.message);

  const verifiedIds = new Set((verifyLinks ?? []).map((row) => row.child_kus_id as string));
  const missing = linkedKusIds.filter((kusId) => !verifiedIds.has(kusId));
  if (missing.length > 0) {
    throw new Error(
      `Některé kusy nejsou v case (${missing.length} chybí). Obsah nebyl kompletně vložen.`
    );
  }

  await recountPolozkaCelkemKDispozici(client, contentPolozkaId);

  return {
    parentKusId: input.parentKusId,
    contentPolozkaId,
    createdKusCount: count,
    insertedKusIds: linkedKusIds,
  };
}
