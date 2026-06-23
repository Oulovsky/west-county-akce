"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertInternalWriteAccess } from "@/lib/auth/internal-role-access-server";
import { createClient } from "@/lib/supabase/server";

export type SetupPolozkaEntry = {
  skladovaPolozkaId: string;
  mnozstvi: number;
};

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export async function deleteSetupAction(setupId: string) {
  if (!setupId.trim()) throw new Error("Chybí setup_id.");

  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);

  const { error } = await supabase.from("setupy").delete().eq("setup_id", setupId);

  if (error) throw new Error(error.message);

  revalidatePath("/sklad/setupy");
  redirect("/sklad/setupy");
}

export async function addSelectionToSetupAction(
  setupId: string,
  entries: SetupPolozkaEntry[]
) {
  if (!setupId.trim()) throw new Error("Chybí setup_id.");
  if (entries.length === 0) throw new Error("Nejsou vybrány žádné položky.");

  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);

  const polozkaIds = entries.map((entry) => entry.skladovaPolozkaId);
  const { data: existingRows, error: existingError } = await supabase
    .from("setup_polozky")
    .select("skladova_polozka_id, mnozstvi")
    .eq("setup_id", setupId)
    .in("skladova_polozka_id", polozkaIds);

  if (existingError) throw new Error(existingError.message);

  const existingByPolozka = new Map(
    (existingRows ?? []).map((row) => [
      row.skladova_polozka_id as string,
      toNumber(row.mnozstvi),
    ])
  );

  for (const entry of entries) {
    if (!entry.skladovaPolozkaId || entry.mnozstvi <= 0) continue;

    const merged =
      (existingByPolozka.get(entry.skladovaPolozkaId) ?? 0) + entry.mnozstvi;

    const { error } = await supabase.from("setup_polozky").upsert(
      {
        setup_id: setupId,
        skladova_polozka_id: entry.skladovaPolozkaId,
        mnozstvi: merged,
      },
      { onConflict: "setup_id,skladova_polozka_id" }
    );

    if (error) throw new Error(error.message);
  }

  revalidatePath("/sklad/setupy");
  revalidatePath(`/sklad/setupy/${setupId}`);
}

export async function removeSetupPolozkaAction(
  setupId: string,
  setupPolozkaId: string
) {
  if (!setupId.trim()) throw new Error("Chybí setup_id.");
  if (!setupPolozkaId.trim()) throw new Error("Chybí setup_polozka_id.");

  const supabase = await createClient();
  await assertInternalWriteAccess(supabase);

  const { error } = await supabase
    .from("setup_polozky")
    .delete()
    .eq("setup_polozka_id", setupPolozkaId)
    .eq("setup_id", setupId);

  if (error) throw new Error(error.message);

  revalidatePath("/sklad/setupy");
  revalidatePath(`/sklad/setupy/${setupId}`);
}
