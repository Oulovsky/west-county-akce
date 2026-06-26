/** Oblast jednotného interního setupu (sdílená ve skladu i portálu). */
export type SetupOblast =
  | "stage"
  | "sound"
  | "lights"
  | "led_wall"
  | "video"
  | "dron"
  | "other";

export const SETUP_OBLASTI: readonly SetupOblast[] = [
  "stage",
  "sound",
  "lights",
  "led_wall",
  "video",
  "dron",
  "other",
] as const;

export type ClientAccountRole = "owner" | "member";

export type ClientAccountStav = "pending" | "active" | "disabled";

export type ClientRegistrationStav = "pending" | "approved" | "rejected";

export type PoptavkaStav =
  | "koncept"
  | "odeslana"
  | "ceka_na_schvaleni"
  | "v_revizi"
  | "schvalena"
  | "zamitnuta"
  | "prevadena_do_zakazky"
  | "objednavka_odeslana"
  | "objednavka_potvrzena"
  | "objednavka_odmitnuta";

export const POPTAVKA_STAVY: readonly PoptavkaStav[] = [
  "koncept",
  "odeslana",
  "ceka_na_schvaleni",
  "v_revizi",
  "schvalena",
  "zamitnuta",
  "prevadena_do_zakazky",
  "objednavka_odeslana",
  "objednavka_potvrzena",
  "objednavka_odmitnuta",
] as const;

/** Poptávky čekající na interní akci (badge, počítadlo inboxu). */
export const PENDING_INTERNAL_POPTAVKA_STAVY: readonly PoptavkaStav[] = [
  "odeslana",
  "objednavka_potvrzena",
] as const;

/** Stavy, ze kterých smí interní tým odeslat závaznou objednávku klientovi. */
export const SEND_BINDING_ORDER_POPTAVKA_STAVY: readonly PoptavkaStav[] = [
  "odeslana",
  "objednavka_odmitnuta",
] as const;

/** Stavy zobrazené v interním seznamu poptávek. */
export const INTERNAL_INBOX_POPTAVKA_STAVY: readonly PoptavkaStav[] = [
  "odeslana",
  "v_revizi",
  "objednavka_odeslana",
  "objednavka_potvrzena",
  "objednavka_odmitnuta",
  "schvalena",
  "prevadena_do_zakazky",
  "zamitnuta",
] as const;

export type PoptavkaObjednavkaPotvrzenaZpusob = "token" | "portal";

/** Stavy, ve kterých smí klient poptávku editovat (DB: client_can_edit_poptavka). */
export const CLIENT_EDITABLE_POPTAVKA_STAVY: readonly PoptavkaStav[] = [
  "koncept",
  "v_revizi",
] as const;

export type PoptavkaFotkaTyp =
  | "rozvadec"
  | "prijezd"
  | "plocha_stage"
  | "povrch_pristup"
  | "misto_akce"
  | "jina";

export const POPTAVKA_FOTKA_TYPY: readonly PoptavkaFotkaTyp[] = [
  "rozvadec",
  "prijezd",
  "plocha_stage",
  "povrch_pristup",
  "misto_akce",
  "jina",
] as const;

export const POPTAVKA_FOTKY_BUCKET = "poptavka-fotky" as const;

export type ClientAccount = {
  account_id: string;
  user_id: string;
  klient_id: string | null;
  role: ClientAccountRole;
  stav: ClientAccountStav;
  jmeno: string | null;
  prijmeni: string | null;
  telefon: string | null;
  schvalil_user_id: string | null;
  schvaleno_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientRegistration = {
  registration_id: string;
  user_id: string;
  navrh_ico: string | null;
  navrh_nazev_firmy: string | null;
  ares_snapshot: Record<string, unknown>;
  stav: ClientRegistrationStav;
  klient_id: string | null;
  schvalil_user_id: string | null;
  schvaleno_at: string | null;
  zamitnuto_duvod: string | null;
  created_at: string;
  updated_at: string;
};

/** Setup viditelný klientovi — bez setup_polozky / skladových položek. */
export type PortalSetup = {
  setup_id: string;
  nazev: string;
  popis: string | null;
  portal_popis: string | null;
  oblast: SetupOblast;
  poradi: number;
};

export type Poptavka = {
  poptavka_id: string;
  cislo_poptavky: string;
  klient_id: string;
  vytvoril_account_id: string;
  stav: PoptavkaStav;
  kontakt_jmeno: string | null;
  kontakt_telefon: string | null;
  kontakt_email: string | null;
  misto_id: string | null;
  misto_nazev: string | null;
  misto_adresa: string | null;
  presny_popis_mista: string | null;
  misto_poznamka: string | null;
  misto_lat: number | null;
  misto_lng: number | null;
  datum_od: string | null;
  datum_do: string | null;
  cas_programu_od: string | null;
  cas_programu_do: string | null;
  cas_prijezd_orientacni: string | null;
  vice_denni: boolean;
  typ_akce: string | null;
  typ_akce_poznamka: string | null;
  stavba_datum: string | null;
  stavba_cas_od: string | null;
  stavba_cas_do: string | null;
  stavba_okno_od: string | null;
  stavba_okno_do: string | null;
  stavba_pristup_od: string | null;
  stavba_omezeni_vjezdu: string | null;
  stavba_poznamka: string | null;
  bourani_datum: string | null;
  bourani_cas_od: string | null;
  bourani_cas_do: string | null;
  bourani_okno_od: string | null;
  bourani_okno_do: string | null;
  bourani_misto_uvolneno_do: string | null;
  bourani_poznamka: string | null;
  logistika_poznamka_klienta: string | null;
  interni_poznamka: string | null;
  schvalil_user_id: string | null;
  schvaleno_at: string | null;
  zamitnuto_duvod: string | null;
  zakazka_id: string | null;
  odeslano_at: string | null;
  objednavka_odeslana_at: string | null;
  objednavka_odeslana_user_id: string | null;
  objednavka_potvrzena_at: string | null;
  objednavka_potvrzena_zpusob: PoptavkaObjednavkaPotvrzenaZpusob | null;
  objednavka_odmitnuta_at: string | null;
  objednavka_odmitnuta_duvod: string | null;
  created_at: string;
  updated_at: string;
};

export type PoptavkaSetup = {
  id: string;
  poptavka_id: string;
  setup_id: string;
  mnozstvi: number;
  poznamka_klienta: string | null;
  poradi: number;
  created_at: string;
  updated_at: string;
};

export type PoptavkaTechnickeUdaje = {
  poptavka_id: string;
  prijezd_poznamka: string | null;
  parkovani_poznamka: string | null;
  elektro_pripojka: string | null;
  elektro_jisteni: string | null;
  elektro_zasuvka: string | null;
  elektro_vzdalenost_m: number | null;
  rozvadece_poznamka: string | null;
  kabelove_trasy: string | null;
  misto_stage: string | null;
  misto_foh: string | null;
  omezeni_hluku: string | null;
  casova_omezeni: string | null;
  dalsi_poznamky: string | null;
  pozadovan_vyjezd_technika: boolean;
  technicke_rezim: "klient_vyplni" | "vyjezd_technika" | null;
  technicke_potvrzeni_odpovednosti_at: string | null;
  technicke_potvrzeni_vyjezd_ceny_at: string | null;
  technik_vyjezd_objednan_at: string | null;
  technik_vyjezd_potvrzeni_fakturace_at: string | null;
  technik_vyjezd_kontakt_jmeno: string | null;
  technik_vyjezd_kontakt_telefon: string | null;
  technik_vyjezd_kontakt_email: string | null;
  technik_vyjezd_preferuje_telefon: boolean;
  technik_vyjezd_preferuje_email: boolean;
  technik_vyjezd_vzdalenost_km: number | null;
  technik_vyjezd_doprava_kc: number | null;
  technik_vyjezd_vypocet_typ: "google_directions" | "orientacni_vzdusna_cara" | null;
  elektro_zdroj_typ: "pevna_pripojka" | "elektrocentrala" | null;
  hlavni_chranic_vetve: string | null;
  pripojky_16a_count: number | null;
  pripojky_32a_count: number | null;
  pripojky_64a_count: number | null;
  pripojky_125a_count: number | null;
  stage_pripojka_rezim: "samostatna_pro_stage" | "sdilena_s_dalsimi_odbery" | null;
  rizika: string[];
  odpovedi_extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PoptavkaFotka = {
  id: string;
  poptavka_id: string;
  storage_bucket: string;
  storage_path: string;
  typ: PoptavkaFotkaTyp;
  popis: string | null;
  poradi: number;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export function isClientEditablePoptavkaStav(stav: PoptavkaStav): boolean {
  return (CLIENT_EDITABLE_POPTAVKA_STAVY as readonly string[]).includes(stav);
}

export function isSetupOblast(value: string): value is SetupOblast {
  return (SETUP_OBLASTI as readonly string[]).includes(value);
}
