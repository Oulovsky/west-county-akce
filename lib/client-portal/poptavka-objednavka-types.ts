import type { PoptavkaFotkaTyp, SetupOblast } from "@/lib/client-portal/types";

export const POPTAVKA_OBJEDNAVKA_DRAFT_DATA_VERSION = 1 as const;
export const POPTAVKA_OBJEDNAVKA_SNAPSHOT_VERSION = 1 as const;
export const POPTAVKA_OBJEDNAVKA_DRAFT_SCHEMA_VERSION = 1 as const;
export const POPTAVKA_OBJEDNAVKA_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type PoptavkaObjednavkaTriVolba = "ano" | "ne" | "nevim";

export type PartyBlock = {
  nazev: string | null;
  ico: string | null;
  dic: string | null;
  adresa: string | null;
  kontaktJmeno: string | null;
  telefon: string | null;
  email: string | null;
  bankovniSpojeni: string | null;
};

export type AkceBlock = {
  nazevAkce: string | null;
  typAkce: string | null;
  typAkceKod: string | null;
  typAkcePoznamka: string | null;
  datumOd: string | null;
  datumDo: string | null;
  casProgramuOd: string | null;
  casProgramuDo: string | null;
  viceDenni: boolean;
  poznamka: string | null;
};

export type MistoElektroBlock = {
  pripojka: string | null;
  jisteni: string | null;
  zasuvka: string | null;
  vzdalenostM: number | null;
  rozvadecePoznamka: string | null;
  kabeloveTrasy: string | null;
  kabelPresSilnici: PoptavkaObjednavkaTriVolba | null;
  potrebaElektrocentraly: PoptavkaObjednavkaTriVolba | null;
  vzdalenostRozvadece: string | null;
};

export type MistoTechnickeBlock = {
  nazev: string | null;
  adresa: string | null;
  gps: { lat: number | null; lng: number | null };
  prijezdPopis: string | null;
  pristupovaCesta: string | null;
  povrchTeren: PoptavkaObjednavkaTriVolba | null;
  vjezdTechnikou: PoptavkaObjednavkaTriVolba | null;
  mistoStage: string | null;
  mistoFoh: string | null;
  mistoLedRezie: string | null;
  elektro: MistoElektroBlock;
  omezeniHluku: string | null;
  casovaOmezeni: string | null;
  nocniPraceOmezeni: string | null;
  kotveniZaveseni: string | null;
  pozadavkyPoradatele: string | null;
  dalsiTechnickePoznamky: string | null;
  pozadovanVyjezdTechnika: boolean;
};

export type TerminBlock = {
  datum: string | null;
  casOd: string | null;
  casDo: string | null;
  pristupOd: string | null;
  omezeniVjezdu: string | null;
  poznamka: string | null;
};

export type BouraniBlock = TerminBlock & {
  mistoUvolnenoDo: string | null;
};

export type OrganizaceBlock = {
  prijezdTechniky: string | null;
  stavba: TerminBlock;
  bourani: BouraniBlock;
  soucinnostKlienta: string | null;
};

export type ObjednavkaSetupPolozka = {
  setupId: string;
  nazev: string;
  oblast: SetupOblast;
  /** Počet setupů (konfigurací), ne skladových kusů. */
  mnozstvi: number;
  poznamkaKlienta: string | null;
  poznamkaInterni: string | null;
};

export type OblastPlneniBlock = {
  popis: string | null;
  poznamka: string | null;
};

export type TechnickePlneniBlock = {
  setupy: ObjednavkaSetupPolozka[];
  oblasti: Record<SetupOblast, OblastPlneniBlock>;
  poznamkaKTechnice: string | null;
};

export type SmluvniPodminkyBlock = {
  zavaznost: string;
  soucinnostKlienta: string;
  elektroTechnicke: string;
  pocasiVyssiMoc: string;
  storno: string;
  odpovednostZaMisto: string;
  bezpecnost: string;
  platebni: string | null;
};

export type TextProKlientaBlock = {
  uvod: string | null;
  zaver: string | null;
  poznamkaSefa: string | null;
};

export type FotkaDraft = {
  fotkaId: string;
  typ: PoptavkaFotkaTyp;
  popis: string | null;
  storagePath: string;
  storageBucket: string;
  poradi: number;
  zahrnoutDoObjednavky: boolean;
};

export type FotkaSnapshot = {
  fotkaId: string;
  typ: PoptavkaFotkaTyp;
  popis: string | null;
  storagePath: string;
  storageBucket: string;
  poradi: number;
  publicUrl: string | null;
};

export type PoptavkaObjednavkaDraftData = {
  draftVersion: typeof POPTAVKA_OBJEDNAVKA_DRAFT_DATA_VERSION;
  klient: PartyBlock;
  dodavatel: PartyBlock;
  akce: AkceBlock;
  misto: MistoTechnickeBlock;
  organizace: OrganizaceBlock;
  technickePlneni: TechnickePlneniBlock;
  smluvniPodminky: SmluvniPodminkyBlock;
  textProKlienta: TextProKlientaBlock;
  fotky: FotkaDraft[];
  pricing: null;
  validationWarnings: string[];
};

export type PoptavkaObjednavkaSnapshotMeta = {
  poptavkaId: string;
  cisloPoptavky: string;
  linkId: string;
};

export type PoptavkaObjednavkaSnapshotSources = {
  poptavkaUpdatedAt: string | null;
  draftUpdatedAt: string;
  preparedByUserId: string | null;
};

export type PoptavkaObjednavkaSnapshot = {
  version: typeof POPTAVKA_OBJEDNAVKA_SNAPSHOT_VERSION;
  frozenAt: string;
  draftId: string;
  draftSchemaVersion: number;
  snapshotSchemaVersion: number;
  meta: PoptavkaObjednavkaSnapshotMeta;
  klient: PartyBlock;
  dodavatel: PartyBlock;
  akce: AkceBlock;
  misto: MistoTechnickeBlock;
  organizace: OrganizaceBlock;
  technickePlneni: TechnickePlneniBlock;
  smluvniPodminky: SmluvniPodminkyBlock;
  textProKlienta: TextProKlientaBlock;
  fotky: FotkaSnapshot[];
  pricing: null;
  sources: PoptavkaObjednavkaSnapshotSources;
};

export type DraftToSnapshotParams = {
  draft: PoptavkaObjednavkaDraftData;
  draftId: string;
  linkId: string;
  meta: Pick<PoptavkaObjednavkaSnapshotMeta, "poptavkaId" | "cisloPoptavky">;
  sources: PoptavkaObjednavkaSnapshotSources;
  fotkaPublicUrls?: Record<string, string | null | undefined>;
  frozenAt?: string;
  draftSchemaVersion?: number;
  snapshotSchemaVersion?: number;
};
