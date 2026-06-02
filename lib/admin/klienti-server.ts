import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type KlientAccountStavLabel =
  | "bez účtu"
  | "aktivní účet"
  | "deaktivovaný účet"
  | "čeká na aktivaci";

export type KlientListRow = {
  klient_id: string;
  nazev: string;
  ico: string | null;
  dic: string | null;
  email: string | null;
  telefon: string | null;
  adresa: string | null;
  accounts_count: number;
  poptavky_count: number;
  zakazky_count: number;
  account_stav: KlientAccountStavLabel;
  registered_at: string | null;
};

export type KlientDetailData = {
  klient: {
    klient_id: string;
    nazev: string;
    ico: string | null;
    dic: string | null;
    email: string | null;
    telefon: string | null;
    ulice: string | null;
    mesto: string | null;
    psc: string | null;
    poznamka: string | null;
    aktivni: boolean;
  };
  poptavky: Array<{
    poptavka_id: string;
    cislo_poptavky: string;
    stav: string;
    misto_nazev: string | null;
    datum_od: string | null;
    datum_do: string | null;
    odeslano_at: string | null;
  }>;
  zakazky: Array<{
    zakazka_id: string;
    cislo_zakazky: string | null;
    nazev: string | null;
    datum_od: string | null;
    zrusena: boolean | null;
  }>;
  mista: Array<{
    misto_id: string;
    nazev: string;
    adresa_text: string | null;
    aktivni: boolean;
  }>;
  account_stav: KlientAccountStavLabel;
  registered_at: string | null;
};

function formatAdresa(row: {
  ulice: string | null;
  mesto: string | null;
  psc: string | null;
}) {
  return [row.ulice, row.mesto, row.psc].filter(Boolean).join(", ") || null;
}

function resolveAccountStav(
  accounts: Array<{ stav: string }>
): KlientAccountStavLabel {
  if (accounts.length === 0) return "bez účtu";
  if (accounts.some((row) => row.stav === "active")) return "aktivní účet";
  if (accounts.some((row) => row.stav === "disabled")) return "deaktivovaný účet";
  if (accounts.some((row) => row.stav === "pending")) return "čeká na aktivaci";
  return "bez účtu";
}

function computeRegisteredAt(
  registrations: Array<{
    klient_id: string | null;
    created_at: string;
    schvaleno_at: string | null;
  }>,
  accounts: Array<{ klient_id: string | null; created_at: string }>,
  klientId: string
): string | null {
  const candidates: string[] = [];

  for (const row of registrations) {
    if (row.klient_id !== klientId) continue;
    const value = row.schvaleno_at ?? row.created_at;
    if (value) candidates.push(value);
  }

  for (const row of accounts) {
    if (row.klient_id !== klientId) continue;
    if (row.created_at) candidates.push(row.created_at);
  }

  if (candidates.length === 0) return null;
  return candidates.sort()[0];
}

async function loadPortalKlientIds(supabase: SupabaseClient) {
  const [{ data: accountRows }, { data: poptavkaRows }] = await Promise.all([
    supabase.from("client_accounts").select("klient_id").not("klient_id", "is", null),
    supabase.from("poptavky").select("klient_id"),
  ]);

  const ids = new Set<string>();
  for (const row of accountRows ?? []) {
    if (row.klient_id) ids.add(row.klient_id as string);
  }
  for (const row of poptavkaRows ?? []) {
    if (row.klient_id) ids.add(row.klient_id as string);
  }

  return [...ids];
}

export async function loadInternalKlientiList(
  supabase: SupabaseClient
): Promise<KlientListRow[]> {
  const klientIds = await loadPortalKlientIds(supabase);
  if (klientIds.length === 0) return [];

  const [
    { data: klientiRaw, error: klientiError },
    { data: accountsRaw },
    { data: poptavkyRaw },
    { data: zakazkyRaw },
    { data: registrationsRaw },
  ] = await Promise.all([
    supabase
      .from("klienti")
      .select("klient_id, nazev, ico, dic, email, telefon, ulice, mesto, psc")
      .in("klient_id", klientIds)
      .order("nazev", { ascending: true }),
    supabase
      .from("client_accounts")
      .select("klient_id, stav, created_at, user_id")
      .in("klient_id", klientIds),
    supabase.from("poptavky").select("klient_id").in("klient_id", klientIds),
    supabase.from("zakazky").select("klient_id").in("klient_id", klientIds),
    supabase
      .from("client_registrations")
      .select("klient_id, created_at, schvaleno_at")
      .in("klient_id", klientIds),
  ]);

  if (klientiError) {
    throw new Error(klientiError.message);
  }

  const accountsByKlient = new Map<string, Array<{ stav: string; created_at: string }>>();
  for (const row of accountsRaw ?? []) {
    const klientId = row.klient_id as string;
    const list = accountsByKlient.get(klientId) ?? [];
    list.push({ stav: row.stav as string, created_at: row.created_at as string });
    accountsByKlient.set(klientId, list);
  }

  const countByKlient = (rows: Array<{ klient_id: string | null }> | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      if (!row.klient_id) continue;
      map.set(row.klient_id, (map.get(row.klient_id) ?? 0) + 1);
    }
    return map;
  };

  const poptavkyCount = countByKlient(poptavkyRaw);
  const zakazkyCount = countByKlient(zakazkyRaw);

  const registeredAtByKlient = new Map<string, string>();
  for (const klientId of klientIds) {
    const registeredAt = computeRegisteredAt(
      registrationsRaw ?? [],
      accountsRaw ?? [],
      klientId
    );
    if (registeredAt) {
      registeredAtByKlient.set(klientId, registeredAt);
    }
  }

  return (klientiRaw ?? []).map((row) => {
    const klientId = row.klient_id as string;
    const accounts = accountsByKlient.get(klientId) ?? [];

    return {
      klient_id: klientId,
      nazev: row.nazev as string,
      ico: row.ico as string | null,
      dic: row.dic as string | null,
      email: row.email as string | null,
      telefon: row.telefon as string | null,
      adresa: formatAdresa(row),
      accounts_count: accounts.length,
      poptavky_count: poptavkyCount.get(klientId) ?? 0,
      zakazky_count: zakazkyCount.get(klientId) ?? 0,
      account_stav: resolveAccountStav(accounts),
      registered_at: registeredAtByKlient.get(klientId) ?? null,
    };
  });
}

export async function loadInternalKlientDetail(
  supabase: SupabaseClient,
  klientId: string
): Promise<KlientDetailData | null> {
  const portalIds = await loadPortalKlientIds(supabase);
  if (!portalIds.includes(klientId)) {
    return null;
  }

  const { data: klient, error: klientError } = await supabase
    .from("klienti")
    .select(
      "klient_id, nazev, ico, dic, email, telefon, ulice, mesto, psc, poznamka, aktivni"
    )
    .eq("klient_id", klientId)
    .maybeSingle();

  if (klientError) {
    throw new Error(klientError.message);
  }

  if (!klient) return null;

  const [
    { data: accountsRaw },
    { data: registrationsRaw },
    { data: poptavkyRaw },
    { data: zakazkyRaw },
    { data: mistaRaw },
  ] = await Promise.all([
    supabase
      .from("client_accounts")
      .select("klient_id, stav, created_at")
      .eq("klient_id", klientId),
    supabase
      .from("client_registrations")
      .select("klient_id, created_at, schvaleno_at")
      .eq("klient_id", klientId),
    supabase
      .from("poptavky")
      .select(
        "poptavka_id, cislo_poptavky, stav, misto_nazev, datum_od, datum_do, odeslano_at"
      )
      .eq("klient_id", klientId)
      .order("odeslano_at", { ascending: false }),
    supabase
      .from("zakazky")
      .select("zakazka_id, cislo_zakazky, nazev, datum_od, zrusena")
      .eq("klient_id", klientId)
      .order("datum_od", { ascending: false }),
    supabase
      .from("mista_konani")
      .select("misto_id, nazev, adresa_text, aktivni")
      .eq("klient_id", klientId)
      .order("nazev", { ascending: true }),
  ]);

  const accountsForStav = (accountsRaw ?? []).map((row) => ({
    stav: row.stav as string,
  }));

  return {
    klient: klient as KlientDetailData["klient"],
    poptavky: (poptavkyRaw ?? []) as KlientDetailData["poptavky"],
    zakazky: (zakazkyRaw ?? []) as KlientDetailData["zakazky"],
    mista: (mistaRaw ?? []) as KlientDetailData["mista"],
    account_stav: resolveAccountStav(accountsForStav),
    registered_at: computeRegisteredAt(
      registrationsRaw ?? [],
      accountsRaw ?? [],
      klientId
    ),
  };
}
