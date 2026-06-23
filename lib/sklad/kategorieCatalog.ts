import type {
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
} from "@/lib/sklad/types";

export function sortKategorieRows(rows: SkladKategorie[]): SkladKategorie[] {
  return [...rows].sort((a, b) => {
    const pa = a.poradi ?? 999999;
    const pb = b.poradi ?? 999999;
    if (pa !== pb) return pa - pb;
    return a.nazev.localeCompare(b.nazev, "cs");
  });
}

export function sortPodkategorieRows(
  rows: SkladPodkategorie[]
): SkladPodkategorie[] {
  return [...rows].sort((a, b) => {
    const pa = a.poradi ?? 999999;
    const pb = b.poradi ?? 999999;
    if (pa !== pb) return pa - pb;
    return a.nazev.localeCompare(b.nazev, "cs");
  });
}

export function sortJednotkyRows(rows: SkladJednotka[]): SkladJednotka[] {
  return [...rows].sort((a, b) => {
    const pa = a.poradi ?? 999999;
    const pb = b.poradi ?? 999999;
    if (pa !== pb) return pa - pb;
    return a.nazev.localeCompare(b.nazev, "cs");
  });
}

/** Všechny aktivní kategorie z konfigurace — bez filtru podle okruhu položky. */
export function listActiveKategorie(kategorie: SkladKategorie[]): SkladKategorie[] {
  return sortKategorieRows(
    kategorie.filter((row) => row.aktivni !== false)
  );
}

/** Všechny podkategorie z konfigurace — seřazené. */
export function listActivePodkategorie(
  podkategorie: SkladPodkategorie[]
): SkladPodkategorie[] {
  return sortPodkategorieRows(podkategorie);
}

/** Všechny jednotky z konfigurace — seřazené. */
export function listActiveJednotky(jednotky: SkladJednotka[]): SkladJednotka[] {
  return sortJednotkyRows(jednotky);
}

/**
 * Možnosti podkategorie pro select — celý katalog bez filtru podle kategorie.
 * Aktuálně nastavená hodnota zůstane v seznamu, i když v katalogu chybí.
 */
export function listPodkategorieSelectOptions(
  podkategorie: SkladPodkategorie[],
  currentPodkategorieId?: string | null
): SkladPodkategorie[] {
  const sorted = listActivePodkategorie(podkategorie);

  if (
    !currentPodkategorieId ||
    sorted.some((row) => row.podkategorie_techniky_id === currentPodkategorieId)
  ) {
    return sorted;
  }

  const current = podkategorie.find(
    (row) => row.podkategorie_techniky_id === currentPodkategorieId
  );
  if (current) {
    return [current, ...sorted];
  }

  return sorted;
}

/** Možnosti jednotky pro select — včetně aktuální hodnoty mimo katalog. */
export function listJednotkaSelectOptions(
  jednotky: SkladJednotka[],
  currentValue?: string | null
): SkladJednotka[] {
  const base = listActiveJednotky(jednotky);
  const trimmed = currentValue?.trim();
  if (!trimmed || base.some((row) => row.nazev === trimmed)) {
    return base;
  }

  return [{ jednotka_id: `legacy-${trimmed}`, nazev: trimmed }, ...base];
}

/** @deprecated Použij listPodkategorieSelectOptions */
export function listPodkategorieForKategorie(
  podkategorie: SkladPodkategorie[],
  _kategorieId: string | null,
  currentPodkategorieId?: string | null
): SkladPodkategorie[] {
  return listPodkategorieSelectOptions(podkategorie, currentPodkategorieId);
}
