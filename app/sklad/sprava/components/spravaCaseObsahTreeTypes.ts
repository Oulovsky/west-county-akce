import type {
  SkladBlok,
  SkladJednotka,
  SkladKategorie,
  SkladKusZakazkaAssignmentRow,
  SkladPodkategorie,
  TechnickyVlastnik,
} from "@/lib/sklad/types";
import type {
  SkladKusObsahChildOption,
  SkladKusObsahChildRow,
} from "@/lib/sklad/kusObsahRead";

export type CaseObsahFormDefaults = {
  skladBlokId: string | null;
  kategorieTechnikyId: string | null;
  podkategorieTechnikyId: string | null;
  technickyVlastnikId: string | null;
  jednotka: string;
};

export type PolozkaZakladPatch = {
  kategorieId?: string | null;
  podkategorieId?: string | null;
  blokId?: string | null;
};

/** Pole obohaceného child řádku po inline úpravě položky. */
export type ObsahChildPolozkaAppliedFields = {
  skladBlokId?: string | null;
  blokNazev?: string | null;
  kategorieTechnikyId?: string | null;
  kategorieNazev?: string | null;
  podkategorieTechnikyId?: string | null;
  podkategorieNazev?: string | null;
  technickyVlastnikId?: string | null;
  technickyVlastnikNazev?: string | null;
  jednotka?: string | null;
};

export function applyPolozkaFieldsToFormDefaults(
  prev: CaseObsahFormDefaults,
  fields: ObsahChildPolozkaAppliedFields
): CaseObsahFormDefaults {
  return {
    skladBlokId:
      fields.skladBlokId !== undefined ? fields.skladBlokId : prev.skladBlokId,
    kategorieTechnikyId:
      fields.kategorieTechnikyId !== undefined
        ? fields.kategorieTechnikyId
        : prev.kategorieTechnikyId,
    podkategorieTechnikyId:
      fields.podkategorieTechnikyId !== undefined
        ? fields.podkategorieTechnikyId
        : prev.podkategorieTechnikyId,
    technickyVlastnikId:
      fields.technickyVlastnikId !== undefined
        ? fields.technickyVlastnikId
        : prev.technickyVlastnikId,
    jednotka:
      fields.jednotka !== undefined
        ? (fields.jednotka ?? prev.jednotka)
        : prev.jednotka,
  };
}

export function applyPolozkaFieldsToInheritedLabels<
  T extends {
    blok_nazev?: string | null;
    kategorie_nazev?: string | null;
    podkategorie_nazev?: string | null;
    technicky_vlastnik_nazev?: string | null;
    jednotka?: string | null;
  },
>(prev: T, fields: ObsahChildPolozkaAppliedFields): T {
  return {
    ...prev,
    ...(fields.blokNazev !== undefined ? { blok_nazev: fields.blokNazev } : {}),
    ...(fields.kategorieNazev !== undefined
      ? { kategorie_nazev: fields.kategorieNazev }
      : {}),
    ...(fields.podkategorieNazev !== undefined
      ? { podkategorie_nazev: fields.podkategorieNazev }
      : {}),
    ...(fields.technickyVlastnikNazev !== undefined
      ? { technicky_vlastnik_nazev: fields.technickyVlastnikNazev }
      : {}),
    ...(fields.jednotka !== undefined ? { jednotka: fields.jednotka } : {}),
  };
}

export type SpravaObsahPolozkaUpdaters = {
  savingPolozkaId: string | null;
  onUpdateZaklad: (
    polozkaId: string,
    patch: PolozkaZakladPatch,
    onApplied?: (fields: ObsahChildPolozkaAppliedFields) => void
  ) => void;
  onUpdateVlastnik: (
    polozkaId: string,
    vlastnikId: string,
    onApplied?: (fields: ObsahChildPolozkaAppliedFields) => void
  ) => void;
  onUpdateJednotka: (
    polozkaId: string,
    value: string,
    onApplied?: (fields: ObsahChildPolozkaAppliedFields) => void
  ) => void;
  kategorieOptions: SkladKategorie[];
  getPodkategorieOptions: (
    currentPodkategorieId?: string | null
  ) => SkladPodkategorie[];
  getJednotkaOptions: (currentValue?: string | null) => SkladJednotka[];
};

/** Sdílený stav stromu obsahu kusů — expand, počty a child data. */
export type SpravaCaseObsahTreeBindings = {
  expandedKusIds: ReadonlySet<string>;
  childCountsByKusId: ReadonlyMap<string, number>;
  childrenByParentKusId: ReadonlyMap<string, SkladKusObsahChildRow[]>;
  onToggleExpand: (kusId: string, syncTopLevelUrl?: boolean) => void;
  childAssignmentsByKusId: Record<string, SkladKusZakazkaAssignmentRow>;
  availableChildOptions: SkladKusObsahChildOption[];
  canEditObsah: boolean;
  returnPolozkaId: string;
  openCaseKusId: string | null;
  obsahMode: string | null;
  insertFormKusId: string | null;
  onToggleInsertForm: (kusId: string) => void;
  formDefaults: CaseObsahFormDefaults;
  bloky: SkladBlok[];
  kategorie: SkladKategorie[];
  podkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  vlastnici: TechnickyVlastnik[];
  onCatalogConfigChanged?: () => void | Promise<void>;
  polozkaUpdaters?: SpravaObsahPolozkaUpdaters;
  /** false = rozbalování case jen lokálně (modal výběru), bez router.replace na /sklad */
  syncObsahUrl?: boolean;
};

export function applyObsahChildPolozkaFields(
  child: SkladKusObsahChildRow,
  fields: ObsahChildPolozkaAppliedFields
): SkladKusObsahChildRow {
  return {
    ...child,
    ...(fields.skladBlokId !== undefined
      ? { skladBlokId: fields.skladBlokId }
      : {}),
    ...(fields.blokNazev !== undefined ? { blokNazev: fields.blokNazev } : {}),
    ...(fields.kategorieTechnikyId !== undefined
      ? { kategorieTechnikyId: fields.kategorieTechnikyId }
      : {}),
    ...(fields.kategorieNazev !== undefined
      ? { kategorieNazev: fields.kategorieNazev }
      : {}),
    ...(fields.podkategorieTechnikyId !== undefined
      ? { podkategorieTechnikyId: fields.podkategorieTechnikyId }
      : {}),
    ...(fields.podkategorieNazev !== undefined
      ? { podkategorieNazev: fields.podkategorieNazev }
      : {}),
    ...(fields.technickyVlastnikId !== undefined
      ? { technickyVlastnikId: fields.technickyVlastnikId }
      : {}),
    ...(fields.technickyVlastnikNazev !== undefined
      ? { technickyVlastnikNazev: fields.technickyVlastnikNazev }
      : {}),
    ...(fields.jednotka !== undefined ? { jednotka: fields.jednotka } : {}),
  };
}
