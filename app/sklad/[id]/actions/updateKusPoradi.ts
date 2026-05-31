"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";
import {
  formatSkladKusDuplicatePoradiMessage,
  isKusEvidencniAutoForPoradi,
  toNumber,
} from "@/lib/sklad/helpers";
import { buildSkladKusEvidencniCislo } from "@/lib/sklad/syncPolozkaKusy";

export type UpdateKusPoradiResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateKusPoradiAction(
  formData: FormData
): Promise<UpdateKusPoradiResult> {
  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);
  const skladovaPolozkaId = String(formData.get("skladova_polozka_id") || "");
  const kusId = String(formData.get("kus_id") || "");
  const raw = String(formData.get("poradove_cislo") ?? "").trim();
  const poradi = Number(raw);

  if (!skladovaPolozkaId || !kusId) {
    return { ok: false, error: "Chybí ID položky nebo kusu." };
  }
  if (!Number.isInteger(poradi) || poradi < 1) {
    return {
      ok: false,
      error: "Pořadové číslo musí být celé číslo 1 nebo vyšší.",
    };
  }

  const { data: conflictRows, error: conflictErr } = await supabase
    .from("sklad_polozky_kusy")
    .select("kus_id")
    .eq("skladova_polozka_id", skladovaPolozkaId)
    .eq("poradove_cislo", poradi)
    .neq("kus_id", kusId)
    .limit(1);

  if (conflictErr) {
    return { ok: false, error: conflictErr.message };
  }
  if (conflictRows && conflictRows.length > 0) {
    return { ok: false, error: formatSkladKusDuplicatePoradiMessage(poradi) };
  }

  const { data: kusBefore, error: kusFetchErr } = await supabase
    .from("sklad_polozky_kusy")
    .select("poradove_cislo, evidencni_cislo")
    .eq("kus_id", kusId)
    .maybeSingle();

  if (kusFetchErr) {
    return { ok: false, error: kusFetchErr.message };
  }

  const oldPoradi = toNumber(kusBefore?.poradove_cislo);
  const oldEvid = kusBefore?.evidencni_cislo;

  const { data: polozkaRow, error: polErr } = await supabase
    .from("skladove_polozky")
    .select("nazev")
    .eq("skladova_polozka_id", skladovaPolozkaId)
    .maybeSingle();

  if (polErr) {
    return { ok: false, error: polErr.message };
  }

  const polozkaNazev = String(polozkaRow?.nazev ?? "").trim() || "Kus";

  const payload: {
    poradove_cislo: number;
    evidencni_cislo?: string;
  } = { poradove_cislo: poradi };

  if (oldEvid && isKusEvidencniAutoForPoradi(oldEvid, oldPoradi)) {
    payload.evidencni_cislo = buildSkladKusEvidencniCislo(polozkaNazev, poradi);
  }

  const { error } = await supabase
    .from("sklad_polozky_kusy")
    .update(payload)
    .eq("kus_id", kusId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/sklad/${skladovaPolozkaId}`);
  revalidatePath("/sklad");
  revalidatePath("/sklad/sprava");

  return { ok: true };
}
