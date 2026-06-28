import { normalizeSkladSearchText } from "@/lib/sklad/helpers";

export type SkladPolozkaPickerFilters = {
  query: string;
  okruhNazev: string;
  kategorieNazev: string;
};

export const SKLAD_POLOZKA_PICKER_FILTERS_EMPTY: SkladPolozkaPickerFilters = {
  query: "",
  okruhNazev: "",
  kategorieNazev: "",
};

export type SkladPolozkaPickerItem = {
  id: string;
  nazev: string;
  okruhNazev?: string | null;
  kategorieNazev?: string | null;
  podkategorieNazev?: string | null;
  pozice?: string | null;
  fakturacniCena?: number | null;
  celkemKDispozici?: number | null;
};

export function filterSkladPolozkaPickerItems(
  items: SkladPolozkaPickerItem[],
  filters: SkladPolozkaPickerFilters
): SkladPolozkaPickerItem[] {
  const queryNorm = normalizeSkladSearchText(filters.query.trim());

  return items.filter((item) => {
    if (filters.okruhNazev && item.okruhNazev !== filters.okruhNazev) {
      return false;
    }

    if (filters.kategorieNazev && item.kategorieNazev !== filters.kategorieNazev) {
      return false;
    }

    if (!queryNorm) {
      return true;
    }

    const haystack = [
      item.nazev,
      item.kategorieNazev,
      item.podkategorieNazev,
      item.okruhNazev,
      item.pozice,
    ]
      .map(normalizeSkladSearchText)
      .join(" ");

    return haystack.includes(queryNorm);
  });
}

export function collectSkladPolozkaPickerFilterOptions(items: SkladPolozkaPickerItem[]) {
  const okruhy = new Set<string>();
  const kategorie = new Set<string>();

  for (const item of items) {
    if (item.okruhNazev?.trim()) okruhy.add(item.okruhNazev.trim());
    if (item.kategorieNazev?.trim()) kategorie.add(item.kategorieNazev.trim());
  }

  return {
    okruhy: [...okruhy].sort((a, b) => a.localeCompare(b, "cs")),
    kategorie: [...kategorie].sort((a, b) => a.localeCompare(b, "cs")),
  };
}
