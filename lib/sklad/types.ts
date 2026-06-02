/** Detail položky skladu (RPC get_skladova_polozka_detail). */
export type SkladDetailRow = {
  skladova_polozka_id: string;
  nazev: string;
  kategorie_techniky_id: string | null;
  kategorie_nazev: string | null;
  podkategorie_techniky_id: string | null;
  podkategorie_nazev: string | null;
  pozice: number | string | null;
  jednotka: string;
  celkem_k_dispozici: number | string;
  interni_naklad: number | string | null;
  fakturacni_cena: number | string | null;
  aktivni: boolean;
  poznamka: string | null;
  vytvoreno_dne: string;
  upraveno_dne: string;
};

/** Kategorie techniky — správa, detail, konfigurace. */
export type SkladKategorie = {
  kategorie_techniky_id: string;
  nazev: string;
  poradi?: number | null;
  sklad_blok_id?: string | null;
  blok_nazev?: string | null;
  aktivni?: boolean | null;
};

/** Podkategorie techniky. */
export type SkladPodkategorie = {
  podkategorie_techniky_id: string;
  kategorie_techniky_id: string;
  kategorie_nazev: string | null;
  nazev: string;
  poradi?: number | null;
};

/** Jednotka skladu (ks, m, …). */
export type SkladJednotka = {
  jednotka_id: string;
  nazev: string;
  poradi?: number | null;
};

/** Jednotlivý kus položky. */
export type SkladKusRow = {
  kus_id: string;
  skladova_polozka_id: string;
  poradove_cislo: number;
  evidencni_cislo: string | null;
  stav: string;
  poznamka: string | null;
  aktivni: boolean;
  servisni_poznamka?: string | null;
  servisni_stav_changed_at?: string | null;
  servisni_stav_changed_by?: string | null;
  porizovaci_hodnota?: number | string | null;
  datum_porizeni?: string | null;
  odpisove_pasmo_id?: string | null;
};

/** Konfigurace interních odpisů pro konkrétní kusy techniky. */
export type SkladOdpisovePasmo = {
  odpisove_pasmo_id: string;
  nazev: string;
  pocet_mesicu: number | string;
  aktivni: boolean;
  poradi: number | string | null;
};

export type ZakazkaKusStav =
  | "rezervovano"
  | "nalozeno"
  | "vratit"
  | "vraceno"
  | "poskozeno";

export type ZakazkaKusRow = {
  id: string;
  zakazka_id: string;
  kus_id: string;
  stav: ZakazkaKusStav;
  is_rezerva?: boolean | null;
  created_at: string;
};

export type SkladKusZakazkaAssignmentRow = ZakazkaKusRow & {
  zakazka: {
    zakazka_id: string;
    cislo_zakazky: string | null;
    nazev: string | null;
    datum_od: string | null;
    datum_do: string | null;
  } | null;
};

export type SkladKusHistorieTypAkce =
  | "rezervovano"
  | "nalozeno"
  | "vraceno"
  | "poskozeno"
  | "blokovano"
  | "odblokovano"
  | "v_oprave"
  | "ceka_na_kontrolu"
  | "zkontrolovano"
  | "vyrazeno"
  | "servisni_poznamka"
  | "vlozeno_do_case"
  | "vyjmuto_z_case";

export type SkladKusHistorieRow = {
  historie_id: string;
  kus_id: string;
  zakazka_id: string | null;
  typ_akce: SkladKusHistorieTypAkce;
  poznamka: string | null;
  created_at: string;
  zakazka: {
    zakazka_id: string;
    cislo_zakazky: string | null;
    nazev: string | null;
  } | null;
};

/** Hlášení poškození — detail, okruh, centrální přehled. */
export type SkladPoskozeniRow = {
  poskozeni_id: string;
  skladova_polozka_id: string;
  kus_id: string | null;
  zakazka_id: string | null;
  pocet_kusu: number | string;
  popis: string | null;
  typ_poskozeni: string | null;
  priorita: string | null;
  blokuje_pouziti: boolean;
  stav_reseni: string;
  datum_nahlaseni: string;
  datum_uzavreni: string | null;
  datum_odblokovani?: string | null;
  duvod_odblokovani?: string | null;
};

/** Řádek v tabulce správy skladu (RPC get_skladove_polozky). */
export type SkladPolozkaRow = {
  skladova_polozka_id: string;
  nazev: string;
  kategorie_techniky_id: string | null;
  kategorie_nazev: string | null;
  podkategorie_techniky_id: string | null;
  podkategorie_nazev: string | null;
  celkem_k_dispozici: number;
  jednotka: string | null;
  interni_naklad: number | null;
  fakturacni_cena: number | null;
  sklad_blok_id: string | null;
  blok_nazev: string | null;
  na_sklade: number | null;
  na_akcich: number | null;
  na_zakazkach_fyzicky?: number | null;
  poskozene: number | null;
  kusy_skladem?: number | null;
  kusy_poskozene?: number | null;
  kusy_blokovane_servis?: number | null;
  availability_future_collision?: boolean | null;
  availability_future_planned?: number | null;
  availability_usable?: number | null;
  /** Sloupec pozice ve skladove_polozky — doplňuje se dotazem vedle RPC. */
  pozice?: number | string | null;
  technicky_vlastnik_id?: string | null;
  technicky_vlastnik_nazev?: string | null;
  /** Položka vytvořená pro obsah case — skrytá v hlavním katalogu. */
  je_obsah_case?: boolean;
};

/** Skladový okruh / blok (přehled, dashboard). */
export type SkladBlok = {
  sklad_blok_id: string;
  nazev: string;
  poradi?: number;
  pocet_polozek?: number;
  kusu_celkem?: number;
};

/** Otevřené poškození pro statistiky na dashboardu. */
export type SkladPoskozeniStatRow = {
  poskozeni_id: string;
  pocet_kusu: number | string;
  blokuje_pouziti: boolean;
  datum_uzavreni: string | null;
};

/** Řádek centrálního přehledu poškození. */
export type SkladPoskozeniListRow = {
  poskozeni_id: string;
  skladova_polozka_id: string;
  kus_id: string | null;
  nazev: string;
  pocet_kusu: number;
  typ_poskozeni: string | null;
  priorita: string | null;
  blokuje_pouziti: boolean;
  datum_nahlaseni: string;
  datum_uzavreni: string | null;
};

/** Konfigurace: typ poškození. */
export type SkladTypPoskozeniOption = {
  typ_id: string;
  nazev: string;
  poradi: number | null;
};

/** Konfigurace: priorita poškození. */
export type SkladPrioritaOption = {
  priorita_id: string;
  nazev: string;
  poradi: number | null;
};

/** Konfigurace: vlastník techniky (WEST COUNTY, HDT, …). */
export type TechnickyVlastnik = {
  id: string;
  nazev: string;
  kod: string;
  poznamka: string | null;
  poradi: number;
  aktivni: boolean;
};

export type SkladPolozkaVlastnikRow = {
  skladova_polozka_id: string;
  technicky_vlastnik_id: string | null;
};

/** Statistika poškození (RPC get_statistika_poskozeni). */
export type SkladStatistikaRow = {
  skladova_polozka_id: string;
  nazev: string;
  jednotka: string | null;
  celkem_k_dispozici: number;
  blokovane_kusy: number;
  otevrena_hlaseni: number;
  celkem_hlaseni: number;
};

/** Řádek detailu okruhu (RPC get_sklad_blok_detail). */
export type SkladOkruhRow = {
  sklad_blok_id: string;
  blok_nazev: string;
  skladova_polozka_id: string | null;
  nazev: string | null;
  jednotka: string | null;
  celkem_k_dispozici: number | null;
  aktivni: boolean | null;
  poznamka: string | null;
  na_sklade: number | null;
  na_akcich: number | null;
  poskozene: number | null;
  kategorie_techniky_id: string | null;
  kategorie_nazev: string | null;
  kategorie_poradi: number | null;
  podkategorie_techniky_id: string | null;
  podkategorie_nazev: string | null;
  podkategorie_poradi: number | null;
};

/** Položka v seznamu skladu (okruh / přiřazení). */
export type SkladOkruhItem = {
  skladova_polozka_id: string;
  nazev: string;
  sklad_blok_id: string | null;
  blok_nazev: string | null;
  jednotka: string | null;
  celkem_k_dispozici: number;
};

/** Poškození v kontextu okruhu. */
export type SkladOkruhPoskozeniRow = {
  poskozeni_id: string;
  skladova_polozka_id: string;
  zakazka_id: string | null;
  pocet_kusu: number | string;
  popis: string | null;
  typ_poskozeni: string | null;
  priorita: string | null;
  blokuje_pouziti: boolean;
  stav_reseni: string;
  datum_nahlaseni: string;
  datum_uzavreni: string | null;
  datum_odblokovani: string | null;
  duvod_odblokovani: string | null;
};

/** Kus pro mapování v centrálním přehledu poškození. */
export type SkladKusInfo = Pick<
  SkladKusRow,
  "kus_id" | "skladova_polozka_id" | "poradove_cislo" | "evidencni_cislo"
>;

/** Položka v tabulce okruhu (ItemsTable). */
export type SkladOkruhTableItem = {
  skladova_polozka_id: string;
  nazev: string | null;
  jednotka: string | null;
  celkem_k_dispozici: number | null;
  poznamka: string | null;
};

/** Položka aktivní v modálu poškození okruhu. */
export type SkladDamageModalItem = {
  skladova_polozka_id: string;
  nazev: string;
  jednotka: string | null;
  celkem_k_dispozici: number;
};

/** Zakázka pro výběr v modálu poškození. */
export type SkladZakazkaOption = {
  zakazka_id: string;
  cislo_zakazky: string;
  nazev: string;
  datum_od?: string | null;
  datum_do?: string | null;
};

export type SkladZakazkaAssignmentOption = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  datum_od: string | null;
  datum_do: string | null;
  cas_od?: string | null;
  cas_do?: string | null;
  zrusena?: boolean | null;
};

/** Souhrn poškození položky v okruhu. */
export type SkladOkruhDamageSummary = {
  totalReports: number;
  openReports: number;
  blockedCount: number;
};

/** Klientské filtry přehledu položek ve správě skladu. */
export type SpravaInventoryFilters = {
  query: string;
  onlyDamaged: boolean;
  onlyBlocked: boolean;
  blokId: string;
  kategorieId: string;
};

export const SPRAVA_INVENTORY_FILTERS_EMPTY: SpravaInventoryFilters = {
  query: "",
  onlyDamaged: false,
  onlyBlocked: false,
  blokId: "",
  kategorieId: "",
};
