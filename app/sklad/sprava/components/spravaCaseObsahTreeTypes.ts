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
  formDefaults: CaseObsahFormDefaults;
  bloky: SkladBlok[];
  kategorie: SkladKategorie[];
  podkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  vlastnici: TechnickyVlastnik[];
};
