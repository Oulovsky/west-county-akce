import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoptavkaStav } from "@/lib/client-portal/types";
import {
  INTERNAL_INBOX_POPTAVKA_STAVY,
  PENDING_INTERNAL_POPTAVKA_STAVY,
  SEND_BINDING_ORDER_POPTAVKA_STAVY,
} from "@/lib/client-portal/types";
import { loadPoptavkaFotkyWithUrls } from "@/lib/client-portal/poptavka-fotky-server";
import type { PortalSetupSelection } from "@/lib/client-portal/poptavka-server";
import type {
  PortalSetup,
  Poptavka,
  PoptavkaTechnickeUdaje,
} from "@/lib/client-portal/types";

export {
  INTERNAL_INBOX_POPTAVKA_STAVY,
  PENDING_INTERNAL_POPTAVKA_STAVY,
  SEND_BINDING_ORDER_POPTAVKA_STAVY,
};

const POPTAVKA_DETAIL_SELECT =
  "poptavka_id, cislo_poptavky, klient_id, vytvoril_account_id, stav, kontakt_jmeno, kontakt_telefon, kontakt_email, misto_id, misto_nazev, misto_adresa, misto_poznamka, misto_lat, misto_lng, datum_od, datum_do, cas_programu_od, cas_programu_do, cas_prijezd_orientacni, vice_denni, typ_akce, typ_akce_poznamka, stavba_datum, stavba_cas_od, stavba_cas_do, stavba_okno_od, stavba_okno_do, stavba_pristup_od, stavba_omezeni_vjezdu, stavba_poznamka, bourani_datum, bourani_cas_od, bourani_cas_do, bourani_okno_od, bourani_okno_do, bourani_misto_uvolneno_do, bourani_poznamka, logistika_poznamka_klienta, interni_poznamka, schvalil_user_id, schvaleno_at, zamitnuto_duvod, zakazka_id, odeslano_at, objednavka_odeslana_at, objednavka_odeslana_user_id, objednavka_potvrzena_at, objednavka_potvrzena_zpusob, objednavka_odmitnuta_at, objednavka_odmitnuta_duvod, created_at, updated_at" as const;

export type InternalPoptavkaListRow = Pick<
  Poptavka,
  | "poptavka_id"
  | "cislo_poptavky"
  | "stav"
  | "misto_nazev"
  | "misto_adresa"
  | "datum_od"
  | "datum_do"
  | "odeslano_at"
  | "created_at"
> & {
  klient: { nazev: string | null; ico: string | null } | null;
};

export type InternalPoptavkaDetail = Poptavka & {
  klient: {
    nazev: string | null;
    ico: string | null;
    dic: string | null;
    ulice: string | null;
    mesto: string | null;
    psc: string | null;
    email: string | null;
    telefon: string | null;
  } | null;
  setupy: PortalSetupSelection[];
  technicke_udaje: PoptavkaTechnickeUdaje | null;
  fotky: Awaited<ReturnType<typeof loadPoptavkaFotkyWithUrls>>;
};

export async function loadInternalPoptavkyInbox(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("poptavky")
    .select(
      "poptavka_id, cislo_poptavky, stav, misto_nazev, misto_adresa, datum_od, datum_do, odeslano_at, created_at, klient:klienti(nazev, ico)"
    )
    .in("stav", [...INTERNAL_INBOX_POPTAVKA_STAVY])
    .order("odeslano_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const klientRaw = row.klient;
    const klient = Array.isArray(klientRaw) ? klientRaw[0] : klientRaw;
    return {
      poptavka_id: row.poptavka_id,
      cislo_poptavky: row.cislo_poptavky,
      stav: row.stav,
      misto_nazev: row.misto_nazev,
      misto_adresa: row.misto_adresa,
      datum_od: row.datum_od,
      datum_do: row.datum_do,
      odeslano_at: row.odeslano_at,
      created_at: row.created_at,
      klient: klient as InternalPoptavkaListRow["klient"],
    };
  }) as InternalPoptavkaListRow[];
}

async function loadInternalPoptavkaSetups(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<PortalSetupSelection[]> {
  const { data: setupRows, error } = await supabase
    .from("poptavka_setupy")
    .select(
      "id, poptavka_id, setup_id, mnozstvi, poznamka_klienta, poradi, created_at, updated_at, setup:setupy(setup_id, nazev, popis, portal_popis, oblast, poradi)"
    )
    .eq("poptavka_id", poptavkaId)
    .order("poradi", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (setupRows ?? [])
    .map((row) => {
      const setupRaw = row.setup;
      const setup = Array.isArray(setupRaw) ? setupRaw[0] : setupRaw;
      if (!setup) return null;
      return {
        id: row.id,
        poptavka_id: row.poptavka_id,
        setup_id: row.setup_id,
        mnozstvi: row.mnozstvi,
        poznamka_klienta: row.poznamka_klienta,
        poradi: row.poradi,
        created_at: row.created_at,
        updated_at: row.updated_at,
        setup: setup as PortalSetup,
      };
    })
    .filter((row): row is PortalSetupSelection => row !== null);
}

export async function loadInternalPoptavkaDetail(
  supabase: SupabaseClient,
  poptavkaId: string
): Promise<InternalPoptavkaDetail | null> {
  const { data: poptavka, error } = await supabase
    .from("poptavky")
    .select(POPTAVKA_DETAIL_SELECT)
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!poptavka) {
    return null;
  }

  const [{ data: klient }, setupy, { data: technickeRow }, fotky] = await Promise.all([
    supabase
      .from("klienti")
      .select("nazev, ico, dic, ulice, mesto, psc, email, telefon")
      .eq("klient_id", poptavka.klient_id)
      .maybeSingle(),
    loadInternalPoptavkaSetups(supabase, poptavkaId),
    supabase
      .from("poptavka_technicke_udaje")
      .select(
        "poptavka_id, prijezd_poznamka, parkovani_poznamka, elektro_pripojka, elektro_jisteni, elektro_zasuvka, elektro_vzdalenost_m, rozvadece_poznamka, kabelove_trasy, misto_stage, misto_foh, omezeni_hluku, casova_omezeni, dalsi_poznamky, pozadovan_vyjezd_technika, technicke_rezim, technicke_potvrzeni_odpovednosti_at, technicke_potvrzeni_vyjezd_ceny_at, rizika, odpovedi_extra, created_at, updated_at"
      )
      .eq("poptavka_id", poptavkaId)
      .maybeSingle(),
    loadPoptavkaFotkyWithUrls(supabase, poptavkaId),
  ]);

  return {
    ...(poptavka as Poptavka),
    klient: klient ?? null,
    setupy,
    technicke_udaje: (technickeRow as PoptavkaTechnickeUdaje | null) ?? null,
    fotky,
  };
}

/** První interní reakce: doplnění nebo odmítnutí (současné inbox akce). */
export function canInternalFirstReactOnPoptavka(stav: PoptavkaStav) {
  return stav === "odeslana" || stav === "v_revizi";
}

/** Odeslání závazné objednávky klientovi. */
export function canSendPoptavkaBindingOrder(stav: PoptavkaStav) {
  return (SEND_BINDING_ORDER_POPTAVKA_STAVY as readonly string[]).includes(stav);
}

/** Finální interní schválení k převodu — jen po potvrzení závazné objednávky klientem. */
export function canInternalApproveForConvert(stav: PoptavkaStav) {
  return stav === "objednavka_potvrzena";
}

export function canInternalManagePoptavka(stav: PoptavkaStav) {
  return (
    stav === "odeslana" ||
    stav === "v_revizi" ||
    stav === "objednavka_odeslana" ||
    stav === "objednavka_potvrzena" ||
    stav === "objednavka_odmitnuta" ||
    stav === "schvalena" ||
    stav === "prevadena_do_zakazky" ||
    stav === "zamitnuta"
  );
}

/** @deprecated Alias pro canInternalFirstReactOnPoptavka — zatím řídí existující inbox akce. */
export function canInternalActOnPoptavka(stav: PoptavkaStav) {
  return canInternalFirstReactOnPoptavka(stav);
}

export async function countPendingInternalPoptavky(supabase: SupabaseClient) {
  const { count, error } = await supabase
    .from("poptavky")
    .select("poptavka_id", { count: "exact", head: true })
    .in("stav", [...PENDING_INTERNAL_POPTAVKA_STAVY]);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
