/** Prázdná hodnota v tabulkách (detail, správa). */
export const SKLAD_EMPTY_LABEL = "-" as const;

/** Prázdné datum v přehledech poškození (em dash). */
export const SKLAD_EMPTY_LABEL_EM = "—" as const;

export const SKLAD_DEFAULT_JEDNOTKA = "ks" as const;

/** Sloupec v přehledu správy — po načtení přepočítáno z technika_na_zakazce + zakazky (viz spravaNaZakazkach). */
export const SKLAD_SPRAVA_LABEL_NA_ZAKAZKACH = "Na zakázkách" as const;

/**
 * Zapojené zakázky: nezrušené a s koncem plánu v minulosti nezahrnuté
 * (stejně jako záložka „Zakázky“ v /zakazky oproti archivu).
 */
export const SKLAD_SPRAVA_HINT_NA_ZAKAZKACH =
  "Součet plánované techniky na probíhajících a nadcházejících zakázkách (ne zrušených; zakázky po datu konce se nezapočítávají). Hodnota z RPC se přepočítá v prohlížeči." as const;

export const SKLAD_DEFAULT_PRIORITA = "stredni" as const;

export const SKLAD_DEFAULT_TYP_POSKOZENI = "mechanicke" as const;

export const SKLAD_RPC = {
  getSkladBloky: "get_sklad_bloky",
  getSkladovePolozky: "get_skladove_polozky",
  getSkladBlokDetail: "get_sklad_blok_detail",
  getKategorieTechnikyFull: "get_kategorie_techniky_full",
  getPodkategorieTechnikyFull: "get_podkategorie_techniky_full",
  getJednotkySkladuFull: "get_jednotky_skladu_full",
  getTypyPoskozeniFull: "get_typy_poskozeni_full",
  getPriorityPoskozeniFull: "get_priority_poskozeni_full",
  getSkladovaPolozkaDetail: "get_skladova_polozka_detail",
  getStatistikaPoskozeni: "get_statistika_poskozeni",
  createSkladBlok: "create_sklad_blok",
  createSkladovaPolozka: "create_skladova_polozka",
  deleteSkladBlok: "delete_sklad_blok",
  setSkladBlokPoradi: "set_sklad_blok_poradi",
  setSkladPolozkaBlok: "set_sklad_polozka_blok",
  updateSkladovaPolozka: "update_skladova_polozka",
  updateSkladovaPolozkaDetail: "update_skladova_polozka_detail",
  updateSkladovaPolozkaZaklad: "update_skladova_polozka_zaklad",
  createJednotkaSkladu: "create_jednotka_skladu",
  createKategorieTechniky: "create_kategorie_techniky",
  updateKategorieTechniky: "update_kategorie_techniky",
  deleteKategorieTechniky: "delete_kategorie_techniky",
  createPodkategorieTechniky: "create_podkategorie_techniky",
  updatePodkategorieTechniky: "update_podkategorie_techniky",
  deletePodkategorieTechniky: "delete_podkategorie_techniky",
  setPodkategoriePoradi: "set_podkategorie_poradi",
  createTypPoskozeni: "create_typ_poskozeni",
  updateTypPoskozeni: "update_typ_poskozeni",
  deleteTypPoskozeni: "delete_typ_poskozeni",
  setTypyPoskozeniPoradi: "set_typy_poskozeni_poradi",
  createPrioritaPoskozeni: "create_priorita_poskozeni",
  updatePrioritaPoskozeni: "update_priorita_poskozeni",
  deletePrioritaPoskozeni: "delete_priorita_poskozeni",
  setPriorityPoskozeniPoradi: "set_priority_poskozeni_poradi",
} as const;

export const SKLAD_TABLE = {
  hlaseniPoskozeni: "hlaseni_poskozeni",
  skladPolozkyKusy: "sklad_polozky_kusy",
  skladovePolozky: "skladove_polozky",
  skladBloky: "sklad_bloky",
  kategorieTechniky: "kategorie_techniky",
  podkategorieTechniky: "podkategorie_techniky",
  jednotkySkladu: "jednotky_skladu",
  typyPoskozeni: "typy_poskozeni",
  priorityPoskozeni: "priority_poskozeni",
  technikaNaZakazce: "technika_na_zakazce",
  zakazky: "zakazky",
} as const;

export const SKLAD_REALTIME_CHANNEL = {
  homePoskozeni: "sklad-home-poskozeni",
  spravaKategorie: "sklad-sprava-kategorie",
  spravaPodkategorie: "sklad-sprava-podkategorie",
  spravaJednotky: "sklad-sprava-jednotky",
  spravaPoskozeni: "sklad-sprava-poskozeni",
  konfigTypyPoskozeni: "typy-poskozeni-realtime",
  konfigPriorityPoskozeni: "priority-poskozeni-realtime",
} as const;

export const SKLAD_KUS_STATUS_CLASS = {
  blokovano: "border-red-700 bg-red-950 text-red-200",
  poskozenoPouzitelne: "border-amber-700 bg-amber-950 text-amber-200",
  ok: "border-emerald-700 bg-emerald-950 text-emerald-200",
} as const;

export const SKLAD_PRIORITA_BADGE_CLASS = {
  kriticka: "bg-red-600",
  vysoka: "bg-orange-500",
  stredni: "bg-yellow-500 text-slate-950",
  nizka: "bg-slate-500",
  default: "bg-slate-600",
} as const;

export const SKLAD_FALLBACK_TYP_POSKOZENI_OPTIONS = [
  { value: "mechanicke", label: "mechanické" },
  { value: "elektricke", label: "elektrické" },
  { value: "vizualni", label: "vizuální" },
  { value: "jine", label: "jiné" },
] as const;

export const SKLAD_FALLBACK_PRIORITA_OPTIONS = [
  { value: "nizka", label: "nízká" },
  { value: "stredni", label: "střední" },
  { value: "vysoka", label: "vysoká" },
  { value: "kriticka", label: "kritická" },
] as const;

export const SKLAD_KUS_SELECT_FIELDS =
  "kus_id, skladova_polozka_id, poradove_cislo, evidencni_cislo, stav, poznamka, aktivni" as const;

export const SKLAD_POSKOZENI_SELECT_FIELDS =
  "poskozeni_id, pocet_kusu, blokuje_pouziti, datum_uzavreni" as const;

export const SKLAD_POSKOZENI_DETAIL_FIELDS =
  "poskozeni_id, skladova_polozka_id, kus_id, zakazka_id, pocet_kusu, popis, typ_poskozeni, priorita, blokuje_pouziti, stav_reseni, datum_nahlaseni, datum_uzavreni" as const;
