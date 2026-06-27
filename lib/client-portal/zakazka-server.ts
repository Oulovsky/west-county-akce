import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { formatPoptavkaDate, formatPoptavkaDateRange } from "@/lib/client-portal/poptavka-form";
import {
  loadPoptavkaDetail,
  type PortalSetupSelection,
  type PoptavkaDetail,
} from "@/lib/client-portal/poptavka-server";
import type { PoptavkaFotkaWithUrl } from "@/lib/client-portal/poptavka-fotky-shared";
import type { PoptavkaTechnickeUdaje } from "@/lib/client-portal/types";
import { getWorkflowStatusLabel } from "@/lib/zakazka-workflow";

export type ClientZakazkaListRow = {
  zakazka_id: string;
  nazev: string | null;
  misto: string | null;
  akce_od: string | null;
  akce_do: string | null;
  datum_od: string | null;
  datum_do: string | null;
  workflow_stav: string | null;
  zrusena: boolean;
  zdroj_poptavka_id: string | null;
  cislo_poptavky: string | null;
};

export type ClientZakazkaDetail = {
  zakazka_id: string;
  nazev: string | null;
  misto: string | null;
  akce_od: string | null;
  akce_do: string | null;
  datum_od: string | null;
  datum_do: string | null;
  cas_od: string | null;
  cas_do: string | null;
  workflow_stav: string | null;
  zrusena: boolean;
  zdroj_poptavka_id: string | null;
  sourcePoptavka: {
    poptavka_id: string;
    cislo_poptavky: string;
    typ_akce: string | null;
    misto_poznamka: string | null;
    cas_programu_od: string | null;
    cas_programu_do: string | null;
  } | null;
  setupy: PortalSetupSelection[];
  technicke_udaje: PoptavkaTechnickeUdaje | null;
  fotky: PoptavkaFotkaWithUrl[];
};

const CLIENT_ZAKAZKA_LIST_SELECT =
  "zakazka_id, nazev, misto, akce_od, akce_do, datum_od, datum_do, workflow_stav, zrusena, zdroj_poptavka_id" as const;

export function formatClientZakazkaStatus(row: {
  workflow_stav: string | null;
  zrusena: boolean;
}) {
  if (row.zrusena) return "Zrušeno";
  return getWorkflowStatusLabel(row.workflow_stav);
}

export function formatClientZakazkaTermin(row: {
  akce_od: string | null;
  akce_do: string | null;
  datum_od: string | null;
  datum_do: string | null;
}) {
  if (row.akce_od || row.akce_do) {
    const from = row.akce_od ? formatPoptavkaDate(row.akce_od.slice(0, 10)) : "—";
    const to = row.akce_do ? formatPoptavkaDate(row.akce_do.slice(0, 10)) : null;
    if (!to || from === to) return from;
    return `${from} – ${to}`;
  }

  return formatPoptavkaDateRange(row.datum_od, row.datum_do);
}

export async function loadClientZakazkyList(supabase: SupabaseClient) {
  await requireActiveClientPortalSession(supabase);

  const { data, error } = await supabase
    .from("zakazky")
    .select(CLIENT_ZAKAZKA_LIST_SELECT)
    .order("akce_od", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Omit<ClientZakazkaListRow, "cislo_poptavky">[];
  const poptavkaIds = rows
    .map((row) => row.zdroj_poptavka_id)
    .filter((value): value is string => Boolean(value));

  let cisloByPoptavkaId = new Map<string, string>();

  if (poptavkaIds.length > 0) {
    const { data: poptavky, error: poptavkyError } = await supabase
      .from("poptavky")
      .select("poptavka_id, cislo_poptavky")
      .in("poptavka_id", poptavkaIds);

    if (poptavkyError) {
      throw new Error(poptavkyError.message);
    }

    cisloByPoptavkaId = new Map(
      (poptavky ?? []).map((row) => [row.poptavka_id as string, row.cislo_poptavky as string])
    );
  }

  return rows.map((row) => ({
    ...row,
    cislo_poptavky: row.zdroj_poptavka_id
      ? (cisloByPoptavkaId.get(row.zdroj_poptavka_id) ?? null)
      : null,
  })) as ClientZakazkaListRow[];
}

export async function loadClientZakazkaDetail(
  supabase: SupabaseClient,
  zakazkaId: string
): Promise<ClientZakazkaDetail | null> {
  await requireActiveClientPortalSession(supabase);

  const { data: zakazka, error } = await supabase
    .from("zakazky")
    .select(
      "zakazka_id, nazev, misto, akce_od, akce_do, datum_od, datum_do, cas_od, cas_do, workflow_stav, zrusena, zdroj_poptavka_id"
    )
    .eq("zakazka_id", zakazkaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!zakazka) {
    return null;
  }

  let sourcePoptavka: PoptavkaDetail | null = null;

  if (zakazka.zdroj_poptavka_id) {
    sourcePoptavka = await loadPoptavkaDetail(supabase, zakazka.zdroj_poptavka_id as string);
  }

  return {
    zakazka_id: zakazka.zakazka_id as string,
    nazev: zakazka.nazev as string | null,
    misto: zakazka.misto as string | null,
    akce_od: zakazka.akce_od as string | null,
    akce_do: zakazka.akce_do as string | null,
    datum_od: zakazka.datum_od as string | null,
    datum_do: zakazka.datum_do as string | null,
    cas_od: zakazka.cas_od as string | null,
    cas_do: zakazka.cas_do as string | null,
    workflow_stav: zakazka.workflow_stav as string | null,
    zrusena: Boolean(zakazka.zrusena),
    zdroj_poptavka_id: zakazka.zdroj_poptavka_id as string | null,
    sourcePoptavka: sourcePoptavka
      ? {
          poptavka_id: sourcePoptavka.poptavka_id,
          cislo_poptavky: sourcePoptavka.cislo_poptavky,
          typ_akce: sourcePoptavka.typ_akce,
          misto_poznamka: sourcePoptavka.misto_poznamka,
          cas_programu_od: sourcePoptavka.cas_programu_od,
          cas_programu_do: sourcePoptavka.cas_programu_do,
        }
      : null,
    setupy: sourcePoptavka?.setupy ?? [],
    technicke_udaje: sourcePoptavka?.technicke_udaje ?? null,
    fotky: sourcePoptavka?.fotky ?? [],
  };
}
