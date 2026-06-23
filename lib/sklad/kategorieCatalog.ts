import type { SkladKategorie, SkladPodkategorie } from "@/lib/sklad/types";

export function sortKategorieRows(rows: SkladKategorie[]): SkladKategorie[] {
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

export function listPodkategorieForKategorie(
  podkategorie: SkladPodkategorie[],
  kategorieId: string | null
): SkladPodkategorie[] {
  if (!kategorieId) return [];
  return podkategorie.filter((row) => row.kategorie_techniky_id === kategorieId);
}
