import "server-only";

import type { PoptavkaSetupInput } from "@/lib/client-portal/poptavka-form";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SETUP_OBLASTI,
  type PortalSetup,
  type Poptavka,
  type PoptavkaSetup,
  type PoptavkaTechnickeUdaje,
  type SetupOblast,
  isClientEditablePoptavkaStav,
  isSetupOblast,
} from "@/lib/client-portal/types";
import {
  signPoptavkaFotkaThumbnailUrls,
  type PoptavkaFotkaWithUrl,
} from "@/lib/client-portal/poptavka-fotky-server";
import {
  logPoptavkaFotkyLoadStats,
  normalizePoptavkaFotkyRows,
} from "@/lib/client-portal/poptavka-fotky-dedup";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";

export type PortalSetupSelection = PoptavkaSetup & {
  setup: PortalSetup;
};

export type PoptavkaListRow = Pick<
  Poptavka,
  | "poptavka_id"
  | "cislo_poptavky"
  | "stav"
  | "misto_nazev"
  | "misto_adresa"
  | "datum_od"
  | "datum_do"
  | "zakazka_id"
  | "created_at"
>;

export type PoptavkaDetail = Poptavka & {
  setupy: PortalSetupSelection[];
  technicke_udaje: PoptavkaTechnickeUdaje | null;
  fotky: PoptavkaFotkaWithUrl[];
};

export type PortalSetupsByOblast = Record<SetupOblast, PortalSetup[]>;

const POPTAVKA_LIST_SELECT =
  "poptavka_id, cislo_poptavky, stav, misto_nazev, misto_adresa, datum_od, datum_do, zakazka_id, created_at" as const;

const POPTAVKA_DETAIL_SELECT =
  "poptavka_id, cislo_poptavky, klient_id, vytvoril_account_id, stav, kontakt_jmeno, kontakt_telefon, kontakt_email, misto_id, misto_nazev, misto_adresa, misto_poznamka, presny_popis_mista, misto_lat, misto_lng, datum_od, datum_do, cas_programu_od, cas_programu_do, cas_prijezd_orientacni, vice_denni, typ_akce, typ_akce_poznamka, wizard_krok, stavba_datum, stavba_cas_od, stavba_cas_do, stavba_okno_od, stavba_okno_do, stavba_pristup_od, stavba_omezeni_vjezdu, stavba_poznamka, bourani_datum, bourani_cas_od, bourani_cas_do, bourani_okno_od, bourani_okno_do, bourani_misto_uvolneno_do, bourani_poznamka, logistika_poznamka_klienta, schvalil_user_id, schvaleno_at, zamitnuto_duvod, zakazka_id, odeslano_at, objednavka_odeslana_at, objednavka_odeslana_user_id, objednavka_potvrzena_at, objednavka_potvrzena_zpusob, objednavka_odmitnuta_at, objednavka_odmitnuta_duvod, created_at, updated_at" as const;

export async function generateCisloPoptavky(supabase: SupabaseClient) {
  const year = new Date().getFullYear();
  const prefix = `POP/${year}/`;

  const { data, error } = await supabase
    .from("poptavky")
    .select("cislo_poptavky")
    .like("cislo_poptavky", `${prefix}%`)
    .order("cislo_poptavky", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  let next = 1;
  if (data?.[0]?.cislo_poptavky) {
    const parts = data[0].cislo_poptavky.split("/");
    const last = parseInt(parts[parts.length - 1] ?? "", 10);
    if (!Number.isNaN(last)) {
      next = last + 1;
    }
  }

  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function loadPortalSetups(
  supabase: SupabaseClient
): Promise<PortalSetupsByOblast> {
  const { data, error } = await supabase
    .from("setupy")
    .select("setup_id, nazev, popis, portal_popis, oblast, poradi")
    .eq("aktivni", true)
    .eq("dostupne_v_portalu", true)
    .order("poradi", { ascending: true })
    .order("nazev", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const grouped = Object.fromEntries(
    SETUP_OBLASTI.map((oblast) => [oblast, [] as PortalSetup[]])
  ) as PortalSetupsByOblast;

  for (const row of data ?? []) {
    const oblast = isSetupOblast(row.oblast) ? row.oblast : "other";
    grouped[oblast].push(row as PortalSetup);
  }

  return grouped;
}

export async function filterPortalSetupSelections(
  supabase: SupabaseClient,
  setupy: PoptavkaSetupInput[]
): Promise<{ setupy: PoptavkaSetupInput[]; rejectedCount: number }> {
  if (setupy.length === 0) {
    return { setupy: [], rejectedCount: 0 };
  }

  const setupIds = [...new Set(setupy.map((row) => row.setup_id))];
  const { data, error } = await supabase
    .from("setupy")
    .select("setup_id")
    .in("setup_id", setupIds)
    .eq("aktivni", true)
    .eq("dostupne_v_portalu", true);

  if (error) {
    throw new Error(error.message);
  }

  const allowed = new Set((data ?? []).map((row) => row.setup_id as string));
  const filtered = setupy.filter((row) => allowed.has(row.setup_id));

  return {
    setupy: filtered,
    rejectedCount: setupy.length - filtered.length,
  };
}

export async function loadClientPoptavkyList(supabase: SupabaseClient) {
  await requireActiveClientPortalSession(supabase);

  const { data, error } = await supabase
    .from("poptavky")
    .select(POPTAVKA_LIST_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PoptavkaListRow[];
}

export async function loadPoptavkaDetail(
  supabase: SupabaseClient,
  poptavkaId: string,
  options?: { logTiming?: boolean }
): Promise<PoptavkaDetail | null> {
  const logTiming = options?.logTiming ?? false;
  const startedAt = Date.now();

  if (logTiming) {
    console.info("[portal poptavka detail] start", { poptavkaId });
  }

  await requireActiveClientPortalSession(supabase);

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

  const baseDataMs = Date.now() - startedAt;
  if (logTiming) {
    console.info("[portal poptavka detail] base data ms", { poptavkaId, ms: baseDataMs });
  }

  const { data: setupRows, error: setupError } = await supabase
    .from("poptavka_setupy")
    .select(
      "id, poptavka_id, setup_id, mnozstvi, poznamka_klienta, poradi, created_at, updated_at, setup:setupy(setup_id, nazev, popis, portal_popis, oblast, poradi)"
    )
    .eq("poptavka_id", poptavkaId)
    .order("poradi", { ascending: true });

  if (setupError) {
    throw new Error(setupError.message);
  }

  const setupy: PortalSetupSelection[] = (setupRows ?? [])
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

  const fotkyMetadataStartedAt = Date.now();
  const [{ data: technickeRow }, fotkyMetadata] = await Promise.all([
    supabase
      .from("poptavka_technicke_udaje")
      .select(
        "poptavka_id, prijezd_poznamka, parkovani_poznamka, elektro_pripojka, elektro_jisteni, elektro_zasuvka, elektro_vzdalenost_m, elektro_zdroj_typ, hlavni_chranic_vetve, pripojky_16a_count, pripojky_32a_count, pripojky_64a_count, pripojky_125a_count, stage_pripojka_rezim, rozvadece_poznamka, kabelove_trasy, misto_stage, misto_foh, omezeni_hluku, casova_omezeni, dalsi_poznamky, pozadovan_vyjezd_technika, technicke_rezim, technicke_potvrzeni_odpovednosti_at, technicke_potvrzeni_vyjezd_ceny_at, technik_vyjezd_objednan_at, technik_vyjezd_potvrzeni_fakturace_at, technik_vyjezd_kontakt_jmeno, technik_vyjezd_kontakt_telefon, technik_vyjezd_kontakt_email, technik_vyjezd_preferuje_telefon, technik_vyjezd_preferuje_email, technik_vyjezd_vzdalenost_km, technik_vyjezd_doprava_kc, technik_vyjezd_vypocet_typ, rizika, odpovedi_extra, created_at, updated_at"
      )
      .eq("poptavka_id", poptavkaId)
      .maybeSingle(),
    supabase
      .from("poptavka_fotky")
      .select(
        "id, poptavka_id, storage_bucket, storage_path, thumbnail_storage_path, typ, popis, poradi, original_filename, mime_type, size_bytes, thumbnail_size_bytes, source_fotka_id, created_at"
      )
      .eq("poptavka_id", poptavkaId)
      .order("poradi", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const fotkyMetadataMs = Date.now() - fotkyMetadataStartedAt;
  if (logTiming) {
    console.info("[portal poptavka detail] fotky metadata count/ms", {
      poptavkaId,
      count: fotkyMetadata.data?.length ?? 0,
      ms: fotkyMetadataMs,
    });
  }

  if (fotkyMetadata.error) {
    throw new Error(fotkyMetadata.error.message);
  }

  const thumbnailStartedAt = Date.now();
  const rawFotky = (fotkyMetadata.data ?? []) as import("@/lib/client-portal/types").PoptavkaFotka[];
  const { rows: normalizedFotky, duplicatesRemoved, byTyp } = normalizePoptavkaFotkyRows(rawFotky);
  logPoptavkaFotkyLoadStats(
    poptavkaId,
    rawFotky.length,
    normalizedFotky.length,
    duplicatesRemoved,
    byTyp
  );
  const fotky = await signPoptavkaFotkaThumbnailUrls(normalizedFotky);
  const thumbnailMs = Date.now() - thumbnailStartedAt;
  if (logTiming) {
    console.info("[portal poptavka detail] thumbnail urls count/ms", {
      poptavkaId,
      count: fotky.filter((row) => row.thumbnailSignedUrl).length,
      total: fotky.length,
      ms: thumbnailMs,
    });
    console.info("[portal poptavka detail] total ms", {
      poptavkaId,
      ms: Date.now() - startedAt,
    });
  }

  return {
    ...(poptavka as Poptavka),
    setupy,
    technicke_udaje: (technickeRow as PoptavkaTechnickeUdaje | null) ?? null,
    fotky,
  };
}

export function isPoptavkaEditable(poptavka: Pick<Poptavka, "stav">) {
  return isClientEditablePoptavkaStav(poptavka.stav);
}
