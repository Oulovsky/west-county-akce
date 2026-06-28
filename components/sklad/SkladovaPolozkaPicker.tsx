"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatMoneyCzk } from "@/lib/payments";
import {
  collectSkladPolozkaPickerFilterOptions,
  filterSkladPolozkaPickerItems,
  SKLAD_POLOZKA_PICKER_FILTERS_EMPTY,
  type SkladPolozkaPickerItem,
} from "@/lib/sklad/polozkaPicker";

type Props = {
  items: SkladPolozkaPickerItem[];
  value: string | null;
  onChange: (item: SkladPolozkaPickerItem | null) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
};

const fieldClass =
  "h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-slate-500 disabled:opacity-60";

export default function SkladovaPolozkaPicker({
  items,
  value,
  onChange,
  disabled = false,
  placeholder = "Vyberte skladovou položku…",
  label = "Skladová položka",
}: Props) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState(SKLAD_POLOZKA_PICKER_FILTERS_EMPTY);

  const selected = useMemo(
    () => items.find((row) => row.id === value) ?? null,
    [items, value]
  );

  const filterOptions = useMemo(() => collectSkladPolozkaPickerFilterOptions(items), [items]);

  const filteredItems = useMemo(
    () => filterSkladPolozkaPickerItems(items, filters),
    [items, filters]
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [open]);

  function handleOpen() {
    if (disabled) return;
    setOpen(true);
  }

  function handleSelect(item: SkladPolozkaPickerItem) {
    onChange(item);
    setOpen(false);
    setFilters(SKLAD_POLOZKA_PICKER_FILTERS_EMPTY);
  }

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => (open ? setOpen(false) : handleOpen())}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-left text-sm text-white outline-none transition hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
        >
          <span className={selected ? "min-w-0 truncate font-medium" : "text-slate-500"}>
            {selected ? selected.nazev : placeholder}
          </span>
          <span className="shrink-0 text-slate-400" aria-hidden>
            {open ? "▴" : "▾"}
          </span>
        </button>
        {selected ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200 disabled:opacity-60"
            aria-label="Zrušit výběr"
          >
            ✕
          </button>
        ) : null}
      </div>

      {selected ? (
        <p className="mt-1 text-xs text-slate-500">
          {[selected.kategorieNazev, selected.okruhNazev].filter(Boolean).join(" · ")}
          {selected.fakturacniCena != null
            ? ` · ${formatMoneyCzk(selected.fakturacniCena)} / akce`
            : ""}
        </p>
      ) : null}

      {open ? (
        <div className="absolute z-50 mt-2 w-full min-w-[min(100%,28rem)] rounded-xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/40">
          <div className="space-y-3 border-b border-slate-800 p-3">
            <label className="block">
              <span className="sr-only">Hledat ve skladu</span>
              <input
                ref={searchRef}
                type="search"
                value={filters.query}
                onChange={(e) => setFilters((current) => ({ ...current, query: e.target.value }))}
                placeholder="Hledat ve skladu…"
                autoComplete="off"
                className={fieldClass}
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Okruh</span>
                <select
                  value={filters.okruhNazev}
                  onChange={(e) =>
                    setFilters((current) => ({ ...current, okruhNazev: e.target.value }))
                  }
                  className={fieldClass}
                >
                  <option value="">Všechny okruhy</option>
                  {filterOptions.okruhy.map((okruh) => (
                    <option key={okruh} value={okruh}>
                      {okruh}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Kategorie</span>
                <select
                  value={filters.kategorieNazev}
                  onChange={(e) =>
                    setFilters((current) => ({ ...current, kategorieNazev: e.target.value }))
                  }
                  className={fieldClass}
                >
                  <option value="">Všechny kategorie</option>
                  {filterOptions.kategorie.map((kategorie) => (
                    <option key={kategorie} value={kategorie}>
                      {kategorie}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-xs text-slate-500">
              Zobrazeno {filteredItems.length} z {items.length} položek
            </p>
          </div>

          <ul
            id={listboxId}
            role="listbox"
            className="max-h-72 overflow-y-auto p-2"
            aria-label="Skladové položky"
          >
            {filteredItems.length === 0 ? (
              <li className="rounded-lg px-3 py-4 text-center text-sm text-slate-500">
                Žádná položka neodpovídá filtru.
              </li>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === value;
                const meta = [item.kategorieNazev, item.podkategorieNazev, item.okruhNazev]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li key={item.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={[
                        "mb-1 w-full rounded-lg border px-3 py-2.5 text-left text-sm transition last:mb-0",
                        isSelected
                          ? "border-indigo-500/50 bg-indigo-950/40 text-white"
                          : "border-transparent bg-slate-900/40 text-slate-200 hover:border-slate-700 hover:bg-slate-900",
                      ].join(" ")}
                    >
                      <div className="font-medium">{item.nazev}</div>
                      {meta ? <div className="mt-0.5 text-xs text-slate-400">{meta}</div> : null}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-emerald-200/90">
                          Cena pro akce:{" "}
                          {item.fakturacniCena != null
                            ? formatMoneyCzk(item.fakturacniCena)
                            : "—"}
                        </span>
                        {item.celkemKDispozici != null ? (
                          <span className="text-slate-400">
                            Skladem: {Math.round(item.celkemKDispozici)}
                          </span>
                        ) : null}
                        {item.pozice?.trim() ? (
                          <span className="text-slate-500">Pozice: {item.pozice}</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function skladPolozkaPricingRowToPickerItem(row: {
  skladovaPolozkaId: string;
  nazev: string;
  fakturacniCena: number | null;
  okruhNazev: string | null;
  kategorieNazev: string | null;
  podkategorieNazev?: string | null;
  pozice?: string | null;
  celkemKDispozici?: number | null;
}): SkladPolozkaPickerItem {
  return {
    id: row.skladovaPolozkaId,
    nazev: row.nazev,
    okruhNazev: row.okruhNazev,
    kategorieNazev: row.kategorieNazev,
    podkategorieNazev: row.podkategorieNazev ?? null,
    pozice: row.pozice ?? null,
    fakturacniCena: row.fakturacniCena,
    celkemKDispozici: row.celkemKDispozici ?? null,
  };
}
