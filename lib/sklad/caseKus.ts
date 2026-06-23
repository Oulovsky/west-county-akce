import { getSpravaKusDisplayLabel } from "@/lib/sklad/helpers";
import type { SkladKusObsahRow, SkladKusRow, SpravaVybranyKus } from "@/lib/sklad/types";

export type SpravaPolozkaCaseFlags = {
  je_case: boolean;
  je_obsah_case: boolean;
};

export type SpravaCaseMetadata = {
  polozkaFlags: Map<string, SpravaPolozkaCaseFlags>;
  /** Aktivní vazby child → parent case kus (child_kus_id → řádek). */
  activeObsahByChildKusId: Map<string, SkladKusObsahRow>;
  /** child kusy pod parent case kus_id */
  childrenByParentCaseKusId: Map<string, SkladKusObsahRow[]>;
  /** Načtené řádky kusů pro child_kus_id z obsahu */
  childKusById: Map<string, SkladKusRow>;
  /** název položky podle id */
  polozkaNazevById: Map<string, string>;
};

export const EMPTY_SPRAVA_CASE_METADATA: SpravaCaseMetadata = {
  polozkaFlags: new Map(),
  activeObsahByChildKusId: new Map(),
  childrenByParentCaseKusId: new Map(),
  childKusById: new Map(),
  polozkaNazevById: new Map(),
};

export function isPolozkaCase(
  polozkaId: string,
  polozkaNazev: string,
  flags: Map<string, SpravaPolozkaCaseFlags>
): boolean {
  const row = flags.get(polozkaId);
  if (row?.je_case === true) return true;
  if (row?.je_case === false) return false;
  return /^case\b/i.test(polozkaNazev.trim());
}

export function isPolozkaObsahCase(
  polozkaId: string,
  flags: Map<string, SpravaPolozkaCaseFlags>
): boolean {
  return flags.get(polozkaId)?.je_obsah_case === true;
}

export function resolveSpravaKusKind(
  polozkaId: string,
  polozkaNazev: string,
  kusId: string,
  metadata: SpravaCaseMetadata
): SpravaVybranyKus["kind"] {
  if (metadata.activeObsahByChildKusId.has(kusId)) {
    return "child_v_case";
  }
  if (isPolozkaCase(polozkaId, polozkaNazev, metadata.polozkaFlags)) {
    return "case";
  }
  return "bezny";
}

export function buildSpravaVybranyKus(
  kus: SkladKusRow,
  polozkaNazev: string,
  metadata: SpravaCaseMetadata
): SpravaVybranyKus {
  const kind = resolveSpravaKusKind(
    kus.skladova_polozka_id,
    polozkaNazev,
    kus.kus_id,
    metadata
  );
  const label = getSpravaKusDisplayLabel(polozkaNazev, kus);

  if (kind !== "child_v_case") {
    return {
      kusId: kus.kus_id,
      label,
      skladovaPolozkaId: kus.skladova_polozka_id,
      polozkaNazev,
      kind,
    };
  }

  const obsah = metadata.activeObsahByChildKusId.get(kus.kus_id);
  const parentCaseKusId = obsah?.parent_case_kus_id ?? "";
  const parentCaseKus = parentCaseKusId
    ? metadata.childKusById.get(parentCaseKusId)
    : undefined;
  const parentPolozkaNazev =
    parentCaseKus &&
    metadata.polozkaNazevById.get(parentCaseKus.skladova_polozka_id);
  const parentCaseLabel =
    parentCaseKus && parentPolozkaNazev
      ? getSpravaKusDisplayLabel(parentPolozkaNazev, parentCaseKus)
      : parentCaseKusId || undefined;

  return {
    kusId: kus.kus_id,
    label,
    skladovaPolozkaId: kus.skladova_polozka_id,
    polozkaNazev,
    kind,
    parentCaseKusId: parentCaseKusId || undefined,
    parentCaseLabel,
  };
}

/** Child kus vložený v case (řádek stromu ve správě). */
export function buildSpravaVybranyKusFromObsahChild(
  child: {
    childKusId: string;
    skladovaPolozkaId: string;
    polozkaNazev: string;
    displayLabel: string;
  },
  parentCaseKusId: string,
  parentCaseLabel: string
): SpravaVybranyKus {
  return {
    kusId: child.childKusId,
    label: child.displayLabel,
    skladovaPolozkaId: child.skladovaPolozkaId,
    polozkaNazev: child.polozkaNazev,
    kind: "child_v_case",
    parentCaseKusId,
    parentCaseLabel,
  };
}
