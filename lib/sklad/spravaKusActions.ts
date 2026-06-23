import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { buildSkladKusEvidencniCislo } from "@/lib/sklad/syncPolozkaKusy";
import { toNumber } from "@/lib/sklad/helpers";
import type { SkladSupabaseClient } from "@/lib/sklad/queries";

export type SpravaKusActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function prepocitatPocetKusu(
  client: SkladSupabaseClient,
  skladovaPolozkaId: string
): Promise<SpravaKusActionResult> {
  const { count, error: countError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id", { count: "exact", head: true })
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (countError) {
    return { ok: false, error: countError.message };
  }

  const { error: updateError } = await client
    .from(SKLAD_TABLE.skladovePolozky)
    .update({
      celkem_k_dispozici: count ?? 0,
      upraveno_dne: new Date().toISOString(),
    })
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

async function ukoncitAktivniObsahChildKusu(
  client: SkladSupabaseClient,
  childKusId: string
): Promise<SpravaKusActionResult> {
  const {
    data: { user },
  } = await client.auth.getUser();

  const { error } = await client
    .from(SKLAD_TABLE.skladKusObsah)
    .update({
      vyjmuto_at: new Date().toISOString(),
      vyjmul_user_id: user?.id ?? null,
    })
    .eq("child_kus_id", childKusId)
    .is("vyjmuto_at", null);

  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Smaže konkrétní kus včetně aktivní vazby na case a hlášení poškození. */
export async function deleteSpravaKus(
  client: SkladSupabaseClient,
  kusId: string,
  skladovaPolozkaId: string
): Promise<SpravaKusActionResult> {
  const obsahEnd = await ukoncitAktivniObsahChildKusu(client, kusId);
  if (!obsahEnd.ok) return obsahEnd;

  const { error: poskozeniError } = await client
    .from(SKLAD_TABLE.hlaseniPoskozeni)
    .delete()
    .eq("kus_id", kusId);

  if (poskozeniError) {
    return { ok: false, error: poskozeniError.message };
  }

  const { error } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .delete()
    .eq("kus_id", kusId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return prepocitatPocetKusu(client, skladovaPolozkaId);
}

/** Vyjmout child kus z case — kus zůstane ve skladu. */
export async function vyjmoutKusZCase(
  client: SkladSupabaseClient,
  childKusId: string
): Promise<SpravaKusActionResult> {
  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: row, error: fetchError } = await client
    .from(SKLAD_TABLE.skladKusObsah)
    .select("obsah_id")
    .eq("child_kus_id", childKusId)
    .is("vyjmuto_at", null)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  if (!row) {
    return { ok: false, error: "Kus není aktivně vložen v case." };
  }

  const { error } = await client
    .from(SKLAD_TABLE.skladKusObsah)
    .update({
      vyjmuto_at: new Date().toISOString(),
      vyjmul_user_id: user?.id ?? null,
    })
    .eq("obsah_id", row.obsah_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function vlozitObsahDoCase(
  client: SkladSupabaseClient,
  parentCaseKusId: string,
  obsahPolozkaId: string,
  obsahPolozkaNazev: string,
  pocetKusu: number
): Promise<SpravaKusActionResult> {
  const count = Math.max(1, Math.floor(pocetKusu));

  const { data: maxRows, error: maxError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("poradove_cislo")
    .eq("skladova_polozka_id", obsahPolozkaId)
    .order("poradove_cislo", { ascending: false })
    .limit(1);

  if (maxError) {
    return { ok: false, error: maxError.message };
  }

  let nextPoradi = toNumber(maxRows?.[0]?.poradove_cislo) + 1 || 1;
  const createdKusIds: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const poradoveCislo = nextPoradi + i;
    const { data: inserted, error: insertKusError } = await client
      .from(SKLAD_TABLE.skladPolozkyKusy)
      .insert({
        skladova_polozka_id: obsahPolozkaId,
        poradove_cislo: poradoveCislo,
        evidencni_cislo: buildSkladKusEvidencniCislo(
          obsahPolozkaNazev,
          poradoveCislo
        ),
        stav: "skladem",
        aktivni: true,
      })
      .select("kus_id")
      .single();

    if (insertKusError) {
      return { ok: false, error: insertKusError.message };
    }

    if (inserted?.kus_id) {
      createdKusIds.push(inserted.kus_id);
    }
  }

  const prepocet = await prepocitatPocetKusu(client, obsahPolozkaId);
  if (!prepocet.ok) return prepocet;

  for (const childKusId of createdKusIds) {
    const { error: obsahError } = await client.from(SKLAD_TABLE.skladKusObsah).insert({
      parent_case_kus_id: parentCaseKusId,
      child_kus_id: childKusId,
      vlozeno_at: new Date().toISOString(),
    });

    if (obsahError) {
      return { ok: false, error: obsahError.message };
    }
  }

  return { ok: true };
}

/** Vloží existující fyzický kus do konkrétního case kusu (vazba sklad_kus_obsah). */
export async function vlozitExistujiciKusDoCase(
  client: SkladSupabaseClient,
  parentCaseKusId: string,
  childKusId: string
): Promise<SpravaKusActionResult> {
  if (parentCaseKusId === childKusId) {
    return { ok: false, error: "Case nemůže obsahovat sám sebe." };
  }

  const { data: existingChild, error: childObsahError } = await client
    .from(SKLAD_TABLE.skladKusObsah)
    .select("obsah_id")
    .eq("child_kus_id", childKusId)
    .is("vyjmuto_at", null)
    .maybeSingle();

  if (childObsahError) {
    return { ok: false, error: childObsahError.message };
  }

  if (existingChild) {
    return { ok: false, error: "Vybraný kus je už vložen v jiném case." };
  }

  const { error } = await client.from(SKLAD_TABLE.skladKusObsah).insert({
    parent_case_kus_id: parentCaseKusId,
    child_kus_id: childKusId,
    vlozeno_at: new Date().toISOString(),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Přidá jeden nový fyzický kus ke stávající skladové položce. */
export async function pridatKusDoPolozky(
  client: SkladSupabaseClient,
  skladovaPolozkaId: string,
  polozkaNazev: string
): Promise<SpravaKusActionResult & { kusId?: string }> {
  const { data: maxRows, error: maxError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("poradove_cislo")
    .eq("skladova_polozka_id", skladovaPolozkaId)
    .order("poradove_cislo", { ascending: false })
    .limit(1);

  if (maxError) {
    return { ok: false, error: maxError.message };
  }

  const nextNumber = toNumber(maxRows?.[0]?.poradove_cislo) + 1 || 1;
  const nazev = polozkaNazev.trim() || "Kus";

  const { data: inserted, error } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .insert({
      skladova_polozka_id: skladovaPolozkaId,
      poradove_cislo: nextNumber,
      evidencni_cislo: buildSkladKusEvidencniCislo(nazev, nextNumber),
      stav: "skladem",
      aktivni: true,
    })
    .select("kus_id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  const prepocet = await prepocitatPocetKusu(client, skladovaPolozkaId);
  if (!prepocet.ok) {
    return prepocet;
  }

  return { ok: true, kusId: inserted?.kus_id };
}

/** Označí skladovou položku jako case (sloupec je_case). */
export async function nastavitPolozkaJeCase(
  client: SkladSupabaseClient,
  skladovaPolozkaId: string,
  jeCase: boolean
): Promise<SpravaKusActionResult> {
  const { error } = await client
    .from(SKLAD_TABLE.skladovePolozky)
    .update({
      je_case: jeCase,
      upraveno_dne: new Date().toISOString(),
    })
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (error) {
    if (/je_case|column/i.test(error.message)) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
