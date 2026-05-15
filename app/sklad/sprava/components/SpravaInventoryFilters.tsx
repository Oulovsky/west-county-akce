"use client";

import {
  formatNumber,
  hasActiveSpravaInventoryFilters,
} from "@/lib/sklad/helpers";
import {
  SPRAVA_INVENTORY_FILTERS_EMPTY,
  type SkladBlok,
  type SkladKategorie,
  type SpravaInventoryFilters as SpravaInventoryFiltersState,
} from "@/lib/sklad/types";

const fieldClass =
  "h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-slate-500";

const selectClass =
  "h-9 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-slate-500";

type Props = {
  filters: SpravaInventoryFiltersState;
  onChange: (filters: SpravaInventoryFiltersState) => void;
  bloky: SkladBlok[];
  kategorie: SkladKategorie[];
  filteredCount: number;
  totalCount: number;
};

export function SpravaInventoryFilters({
  filters,
  onChange,
  bloky,
  kategorie,
  filteredCount,
  totalCount,
}: Props) {
  const isActive = hasActiveSpravaInventoryFilters(filters);

  const kategorieOptions =
    filters.blokId.length > 0
      ? kategorie.filter((k) => k.sklad_blok_id === filters.blokId)
      : kategorie;

  function patch(partial: Partial<SpravaInventoryFiltersState>) {
    onChange({ ...filters, ...partial });
  }

  function handleBlokChange(blokId: string) {
    const nextKategorie =
      blokId && filters.kategorieId
        ? kategorie.find(
            (k) =>
              k.kategorie_techniky_id === filters.kategorieId &&
              k.sklad_blok_id === blokId
          )
          ? filters.kategorieId
          : ""
        : filters.kategorieId;

    onChange({
      ...filters,
      blokId,
      kategorieId: nextKategorie,
    });
  }

  return (
    <section
      className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3"
      aria-label="Filtrování položek"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Filtrování katalogu
        </span>
        <span className="text-xs text-slate-500">
          Zobrazeno{" "}
          <span className="font-semibold text-slate-300">
            {formatNumber(filteredCount)}
          </span>{" "}
          z {formatNumber(totalCount)}
        </span>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="sprava-search">
            Hledat
          </label>
          <input
            id="sprava-search"
            type="search"
            value={filters.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder="Název, kategorie, podkategorie, okruh…"
            className={fieldClass}
            autoComplete="off"
          />
        </div>

        <div className="w-full sm:w-40">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="sprava-blok">
            Okruh
          </label>
          <select
            id="sprava-blok"
            value={filters.blokId}
            onChange={(e) => handleBlokChange(e.target.value)}
            className={selectClass}
          >
            <option value="">Všechny okruhy</option>
            {bloky.map((blok) => (
              <option key={blok.sklad_blok_id} value={blok.sklad_blok_id}>
                {blok.nazev}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-44">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="sprava-kategorie">
            Kategorie
          </label>
          <select
            id="sprava-kategorie"
            value={filters.kategorieId}
            onChange={(e) => patch({ kategorieId: e.target.value })}
            className={selectClass}
          >
            <option value="">Všechny kategorie</option>
            {kategorieOptions.map((kat) => (
              <option key={kat.kategorie_techniky_id} value={kat.kategorie_techniky_id}>
                {kat.nazev}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-4 pb-0.5 xl:pb-0">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={filters.onlyDamaged}
              onChange={(e) => patch({ onlyDamaged: e.target.checked })}
              className="h-4 w-4 rounded border-slate-600 bg-slate-950"
            />
            <span>Pouze poškozené</span>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={filters.onlyBlocked}
              onChange={(e) => patch({ onlyBlocked: e.target.checked })}
              className="h-4 w-4 rounded border-slate-600 bg-slate-950"
            />
            <span>Blokované / nedostupné</span>
          </label>
        </div>

        {isActive ? (
          <button
            type="button"
            onClick={() => onChange(SPRAVA_INVENTORY_FILTERS_EMPTY)}
            className="h-9 shrink-0 rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
          >
            Zrušit filtry
          </button>
        ) : null}
      </div>
    </section>
  );
}
