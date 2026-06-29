import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import type {
  ClientPlacePreset,
  ClientSetupPreset,
  ClientSetupPresetSetupRow,
  ClientSetupPresetView,
  ClientTechnicalPreset,
} from "@/lib/client-portal/client-presets-shared";
import type { ClientPortalPreviousTechnikaSetupRow } from "@/lib/client-portal/client-previous-technika-shared";
import {
  EMPTY_POPTAVKA_TECHNIKA,
  technikaFromRecord,
  type PoptavkaTechnikaFormValues,
} from "@/lib/client-portal/poptavka-technika-form";
import {
  buildSestavaSummaryLines,
  hasSestavaKonfigurace,
  sestavaFromOdpovediExtra,
} from "@/lib/client-portal/sestava-konfigurator-form";
import { loadPortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-server";
import type { SestavaKonfiguratorState } from "@/lib/client-portal/sestava-konfigurator-types";
import type { SetupOblast } from "@/lib/client-portal/types";
import { isSetupOblast } from "@/lib/client-portal/types";

export type {
  ClientPlacePreset,
  ClientSetupPreset,
  ClientSetupPresetView,
  ClientTechnicalPreset,
} from "@/lib/client-portal/client-presets-shared";

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function parseTechnikaData(raw: unknown): PoptavkaTechnikaFormValues {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_POPTAVKA_TECHNIKA };
  }
  return { ...EMPTY_POPTAVKA_TECHNIKA, ...(raw as Partial<PoptavkaTechnikaFormValues>) };
}

function parseSestavaData(raw: unknown): SestavaKonfiguratorState {
  if (!raw || typeof raw !== "object") {
    return sestavaFromOdpovediExtra({});
  }
  return sestavaFromOdpovediExtra(raw as Record<string, unknown>);
}

function parseSetupPresetRows(raw: unknown): ClientSetupPresetSetupRow[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const setupId = String((row as { setup_id?: string }).setup_id ?? "").trim();
      if (!setupId) return null;
      return {
        setup_id: setupId,
        mnozstvi: Math.max(1, Math.floor(Number((row as { mnozstvi?: number }).mnozstvi) || 1)),
        poznamka_klienta: nullableText((row as { poznamka_klienta?: string }).poznamka_klienta),
      };
    })
    .filter((row): row is ClientSetupPresetSetupRow => row !== null);
}

async function loadPortalSetupMetaMap(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("setupy")
    .select("setup_id, nazev, oblast")
    .eq("aktivni", true)
    .eq("dostupne_v_portalu", true);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, { nazev: string; oblast: SetupOblast }>();
  for (const row of data ?? []) {
    const setupId = row.setup_id as string;
    const oblastRaw = row.oblast as string;
    map.set(setupId, {
      nazev: (row.nazev as string) ?? setupId,
      oblast: isSetupOblast(oblastRaw) ? oblastRaw : "other",
    });
  }
  return map;
}

function enrichSetupPreset(
  preset: ClientSetupPreset,
  portalSetups: Map<string, { nazev: string; oblast: SetupOblast }>,
  katalog: Awaited<ReturnType<typeof loadPortalSestavaKatalog>>
): ClientSetupPresetView {
  const setup_rows: ClientPortalPreviousTechnikaSetupRow[] = [];
  for (const row of preset.setupy) {
    const meta = portalSetups.get(row.setup_id);
    if (!meta) continue;
    setup_rows.push({
      setup_id: row.setup_id,
      nazev: meta.nazev,
      oblast: meta.oblast,
      mnozstvi: row.mnozstvi,
      poznamka_klienta: row.poznamka_klienta,
    });
  }

  const sestava = parseSestavaData(preset.sestava_konfigurator);
  const summary_lines = buildSestavaSummaryLines(sestava, katalog);

  return {
    ...preset,
    setup_rows,
    summary_lines,
  };
}

export async function loadClientPlacePresetsForPortal(
  supabase: SupabaseClient
): Promise<ClientPlacePreset[]> {
  const session = await requireActiveClientPortalSession(supabase);

  const { data, error } = await supabase
    .from("client_place_presets")
    .select(
      "preset_id, nazev, adresa_text, lat, lng, presny_popis_mista, poznamka_prijezd, omezeni_vjezdu, poznamka_manipulace, interni_poznamka_klienta, source_poptavka_id, source_misto_id, updated_at"
    )
    .eq("klient_id", session.account.klient_id!)
    .eq("aktivni", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClientPlacePreset[];
}

export async function loadClientTechnicalPresetsForPortal(
  supabase: SupabaseClient
): Promise<ClientTechnicalPreset[]> {
  const session = await requireActiveClientPortalSession(supabase);

  const { data, error } = await supabase
    .from("client_technical_presets")
    .select("preset_id, nazev, technicke_data, source_poptavka_id, source_misto_id, updated_at")
    .eq("klient_id", session.account.klient_id!)
    .eq("aktivni", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    preset_id: row.preset_id as string,
    nazev: row.nazev as string,
    technicke_data: parseTechnikaData(row.technicke_data),
    source_poptavka_id: (row.source_poptavka_id as string | null) ?? null,
    source_misto_id: (row.source_misto_id as string | null) ?? null,
    updated_at: row.updated_at as string,
  }));
}

export async function loadClientSetupPresetsForPortal(
  supabase: SupabaseClient
): Promise<ClientSetupPresetView[]> {
  const session = await requireActiveClientPortalSession(supabase);

  const [portalSetups, katalog, { data, error }] = await Promise.all([
    loadPortalSetupMetaMap(supabase),
    loadPortalSestavaKatalog(),
    supabase
      .from("client_setup_presets")
      .select(
        "preset_id, nazev, sestava_konfigurator, setupy, popis, source_poptavka_id, source_misto_id, updated_at"
      )
      .eq("klient_id", session.account.klient_id!)
      .eq("aktivni", true)
      .order("updated_at", { ascending: false }),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    enrichSetupPreset(
      {
        preset_id: row.preset_id as string,
        nazev: row.nazev as string,
        sestava_konfigurator: parseSestavaData(row.sestava_konfigurator),
        setupy: parseSetupPresetRows(row.setupy),
        popis: (row.popis as string | null) ?? null,
        source_poptavka_id: (row.source_poptavka_id as string | null) ?? null,
        source_misto_id: (row.source_misto_id as string | null) ?? null,
        updated_at: row.updated_at as string,
      },
      portalSetups,
      katalog
    )
  );
}

type PresetSession = Awaited<ReturnType<typeof requireActiveClientPortalSession>>;

function presetBaseFields(session: PresetSession) {
  return {
    klient_id: session.account.klient_id!,
    account_id: session.account.account_id,
    updated_at: new Date().toISOString(),
  };
}

export async function createClientPlacePreset(
  supabase: SupabaseClient,
  input: Omit<ClientPlacePreset, "preset_id" | "updated_at">
) {
  const session = await requireActiveClientPortalSession(supabase);
  const nazev = input.nazev.trim();
  if (!nazev) throw new Error("Název místa je povinný.");

  const { data, error } = await supabase
    .from("client_place_presets")
    .insert({
      ...presetBaseFields(session),
      nazev,
      adresa_text: nullableText(input.adresa_text),
      lat: input.lat,
      lng: input.lng,
      presny_popis_mista: nullableText(input.presny_popis_mista),
      poznamka_prijezd: nullableText(input.poznamka_prijezd),
      omezeni_vjezdu: nullableText(input.omezeni_vjezdu),
      poznamka_manipulace: nullableText(input.poznamka_manipulace),
      interni_poznamka_klienta: nullableText(input.interni_poznamka_klienta),
      source_poptavka_id: input.source_poptavka_id,
      source_misto_id: input.source_misto_id,
    })
    .select("preset_id")
    .single();

  if (error) throw new Error(error.message);
  return data.preset_id as string;
}

export async function updateClientPlacePreset(
  supabase: SupabaseClient,
  presetId: string,
  input: Omit<ClientPlacePreset, "preset_id" | "updated_at">
) {
  const session = await requireActiveClientPortalSession(supabase);
  const nazev = input.nazev.trim();
  if (!nazev) throw new Error("Název místa je povinný.");

  const { error } = await supabase
    .from("client_place_presets")
    .update({
      nazev,
      adresa_text: nullableText(input.adresa_text),
      lat: input.lat,
      lng: input.lng,
      presny_popis_mista: nullableText(input.presny_popis_mista),
      poznamka_prijezd: nullableText(input.poznamka_prijezd),
      omezeni_vjezdu: nullableText(input.omezeni_vjezdu),
      poznamka_manipulace: nullableText(input.poznamka_manipulace),
      interni_poznamka_klienta: nullableText(input.interni_poznamka_klienta),
      updated_at: new Date().toISOString(),
    })
    .eq("preset_id", presetId)
    .eq("klient_id", session.account.klient_id!);

  if (error) throw new Error(error.message);
}

export async function deleteClientPlacePreset(supabase: SupabaseClient, presetId: string) {
  const session = await requireActiveClientPortalSession(supabase);
  const { error } = await supabase
    .from("client_place_presets")
    .delete()
    .eq("preset_id", presetId)
    .eq("klient_id", session.account.klient_id!);
  if (error) throw new Error(error.message);
}

export async function createClientTechnicalPreset(
  supabase: SupabaseClient,
  input: { nazev: string; technicke_data: PoptavkaTechnikaFormValues; source_poptavka_id?: string | null; source_misto_id?: string | null }
) {
  const session = await requireActiveClientPortalSession(supabase);
  const nazev = input.nazev.trim();
  if (!nazev) throw new Error("Název technického profilu je povinný.");

  const { data, error } = await supabase
    .from("client_technical_presets")
    .insert({
      ...presetBaseFields(session),
      nazev,
      technicke_data: input.technicke_data,
      source_poptavka_id: input.source_poptavka_id ?? null,
      source_misto_id: input.source_misto_id ?? null,
    })
    .select("preset_id")
    .single();

  if (error) throw new Error(error.message);
  return data.preset_id as string;
}

export async function updateClientTechnicalPreset(
  supabase: SupabaseClient,
  presetId: string,
  input: { nazev: string; technicke_data: PoptavkaTechnikaFormValues }
) {
  const session = await requireActiveClientPortalSession(supabase);
  const nazev = input.nazev.trim();
  if (!nazev) throw new Error("Název technického profilu je povinný.");

  const { error } = await supabase
    .from("client_technical_presets")
    .update({
      nazev,
      technicke_data: input.technicke_data,
      updated_at: new Date().toISOString(),
    })
    .eq("preset_id", presetId)
    .eq("klient_id", session.account.klient_id!);

  if (error) throw new Error(error.message);
}

export async function deleteClientTechnicalPreset(supabase: SupabaseClient, presetId: string) {
  const session = await requireActiveClientPortalSession(supabase);
  const { error } = await supabase
    .from("client_technical_presets")
    .delete()
    .eq("preset_id", presetId)
    .eq("klient_id", session.account.klient_id!);
  if (error) throw new Error(error.message);
}

export async function createClientSetupPreset(
  supabase: SupabaseClient,
  input: {
    nazev: string;
    sestava_konfigurator: SestavaKonfiguratorState;
    setupy: ClientSetupPresetSetupRow[];
    popis?: string | null;
    source_poptavka_id?: string | null;
    source_misto_id?: string | null;
  }
) {
  const session = await requireActiveClientPortalSession(supabase);
  const nazev = input.nazev.trim();
  if (!nazev) throw new Error("Název sestavy je povinný.");

  const hasContent =
    hasSestavaKonfigurace(input.sestava_konfigurator) || input.setupy.length > 0;
  if (!hasContent) throw new Error("Sestava nemá žádný obsah.");

  const { data, error } = await supabase
    .from("client_setup_presets")
    .insert({
      ...presetBaseFields(session),
      nazev,
      sestava_konfigurator: input.sestava_konfigurator,
      setupy: input.setupy,
      popis: nullableText(input.popis),
      source_poptavka_id: input.source_poptavka_id ?? null,
      source_misto_id: input.source_misto_id ?? null,
    })
    .select("preset_id")
    .single();

  if (error) throw new Error(error.message);
  return data.preset_id as string;
}

export async function updateClientSetupPreset(
  supabase: SupabaseClient,
  presetId: string,
  input: {
    nazev: string;
    sestava_konfigurator: SestavaKonfiguratorState;
    setupy: ClientSetupPresetSetupRow[];
    popis?: string | null;
  }
) {
  const session = await requireActiveClientPortalSession(supabase);
  const nazev = input.nazev.trim();
  if (!nazev) throw new Error("Název sestavy je povinný.");

  const { error } = await supabase
    .from("client_setup_presets")
    .update({
      nazev,
      sestava_konfigurator: input.sestava_konfigurator,
      setupy: input.setupy,
      popis: nullableText(input.popis),
      updated_at: new Date().toISOString(),
    })
    .eq("preset_id", presetId)
    .eq("klient_id", session.account.klient_id!);

  if (error) throw new Error(error.message);
}

export async function deleteClientSetupPreset(supabase: SupabaseClient, presetId: string) {
  const session = await requireActiveClientPortalSession(supabase);
  const { error } = await supabase
    .from("client_setup_presets")
    .delete()
    .eq("preset_id", presetId)
    .eq("klient_id", session.account.klient_id!);
  if (error) throw new Error(error.message);
}

export async function saveTechnicalPresetFromPoptavkaHistory(
  supabase: SupabaseClient,
  input: { poptavkaId: string; nazev?: string }
) {
  const session = await requireActiveClientPortalSession(supabase);

  const { data: poptavka, error: poptavkaError } = await supabase
    .from("poptavky")
    .select("poptavka_id, misto_id, misto_nazev, cislo_poptavky, datum_od")
    .eq("poptavka_id", input.poptavkaId)
    .eq("klient_id", session.account.klient_id!)
    .maybeSingle();

  if (poptavkaError) throw new Error(poptavkaError.message);
  if (!poptavka) throw new Error("Poptávka nenalezena.");

  const { data: technikaRow, error: technikaError } = await supabase
    .from("poptavka_technicke_udaje")
    .select("*")
    .eq("poptavka_id", input.poptavkaId)
    .maybeSingle();

  if (technikaError) throw new Error(technikaError.message);
  if (!technikaRow) throw new Error("Technické údaje nenalezeny.");

  const technikaValues = technikaFromRecord(technikaRow);
  const defaultName =
    input.nazev?.trim() ||
    `${poptavka.misto_nazev ?? poptavka.cislo_poptavky} — technika`;

  return createClientTechnicalPreset(supabase, {
    nazev: defaultName,
    technicke_data: technikaValues,
    source_poptavka_id: poptavka.poptavka_id,
    source_misto_id: poptavka.misto_id,
  });
}

export async function saveSetupPresetFromPoptavkaHistory(
  supabase: SupabaseClient,
  input: { poptavkaId: string; nazev?: string }
) {
  const session = await requireActiveClientPortalSession(supabase);

  const { data: poptavka, error: poptavkaError } = await supabase
    .from("poptavky")
    .select("poptavka_id, misto_id, misto_nazev, cislo_poptavky")
    .eq("poptavka_id", input.poptavkaId)
    .eq("klient_id", session.account.klient_id!)
    .maybeSingle();

  if (poptavkaError) throw new Error(poptavkaError.message);
  if (!poptavka) throw new Error("Poptávka nenalezena.");

  const [{ data: technikaRow }, { data: setupRows }] = await Promise.all([
    supabase
      .from("poptavka_technicke_udaje")
      .select("odpovedi_extra")
      .eq("poptavka_id", input.poptavkaId)
      .maybeSingle(),
    supabase
      .from("poptavka_setupy")
      .select("setup_id, mnozstvi, poznamka_klienta")
      .eq("poptavka_id", input.poptavkaId)
      .order("poradi", { ascending: true }),
  ]);

  const sestava = sestavaFromOdpovediExtra(
    (technikaRow?.odpovedi_extra as Record<string, unknown> | null) ?? {}
  );
  const setupy = parseSetupPresetRows(setupRows ?? []);

  const defaultName =
    input.nazev?.trim() ||
    `${poptavka.misto_nazev ?? poptavka.cislo_poptavky} — sestava`;

  return createClientSetupPreset(supabase, {
    nazev: defaultName,
    sestava_konfigurator: sestava,
    setupy,
    source_poptavka_id: poptavka.poptavka_id,
    source_misto_id: poptavka.misto_id,
  });
}

export async function savePlacePresetFromPoptavkaHistory(
  supabase: SupabaseClient,
  input: { poptavkaId: string; nazev?: string }
) {
  const session = await requireActiveClientPortalSession(supabase);

  const { data: poptavka, error } = await supabase
    .from("poptavky")
    .select(
      "poptavka_id, misto_id, misto_nazev, misto_adresa, misto_lat, misto_lng, presny_popis_mista, misto_poznamka"
    )
    .eq("poptavka_id", input.poptavkaId)
    .eq("klient_id", session.account.klient_id!)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!poptavka) throw new Error("Poptávka nenalezena.");

  const defaultName =
    input.nazev?.trim() ||
    poptavka.misto_nazev?.trim() ||
    poptavka.misto_adresa?.trim() ||
    "Místo z historie";

  return createClientPlacePreset(supabase, {
    nazev: defaultName,
    adresa_text: poptavka.misto_adresa,
    lat: poptavka.misto_lat,
    lng: poptavka.misto_lng,
    presny_popis_mista: poptavka.presny_popis_mista,
    poznamka_prijezd: poptavka.misto_poznamka,
    omezeni_vjezdu: null,
    poznamka_manipulace: null,
    interni_poznamka_klienta: null,
    source_poptavka_id: poptavka.poptavka_id,
    source_misto_id: poptavka.misto_id,
  });
}
