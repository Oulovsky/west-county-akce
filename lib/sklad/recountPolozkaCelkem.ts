import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SKLAD_RPC, SKLAD_TABLE } from "@/lib/sklad/constants";

/**
 * Nastaví celkem_k_dispozici podle počtu řádků v sklad_polozky_kusy
 * (RPC detail + přímý zápis do tabulky).
 */
export async function recountPolozkaCelkemKDispozici(
  client: SupabaseClient,
  skladovaPolozkaId: string
): Promise<number> {
  const { count, error: countError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id", { count: "exact", head: true })
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (countError) {
    throw new Error(countError.message);
  }

  const kusCount = count ?? 0;

  const { data: detailRaw, error: detailError } = await client.rpc(
    SKLAD_RPC.getSkladovaPolozkaDetail,
    { p_skladova_polozka_id: skladovaPolozkaId }
  );

  if (detailError) {
    throw new Error(detailError.message);
  }

  const detail = ((detailRaw ?? [])[0] ?? null) as {
    nazev?: string;
    jednotka?: string;
    interni_naklad?: number | null;
    fakturacni_cena?: number | null;
  } | null;

  if (detail?.nazev && detail.jednotka) {
    const { error: rpcError } = await client.rpc(SKLAD_RPC.updateSkladovaPolozkaDetail, {
      p_id: skladovaPolozkaId,
      p_nazev: detail.nazev,
      p_kusy: kusCount,
      p_jednotka: detail.jednotka,
      p_naklad: detail.interni_naklad ?? null,
      p_rent: detail.fakturacni_cena ?? null,
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }
  }

  const { error: updateError } = await client
    .from(SKLAD_TABLE.skladovePolozky)
    .update({
      celkem_k_dispozici: kusCount,
      upraveno_dne: new Date().toISOString(),
    })
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return kusCount;
}
