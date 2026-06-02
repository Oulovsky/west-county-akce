"use client";

import { useMemo, useState } from "react";
import type { SkladKusObsahChildOption } from "@/lib/sklad/kusObsah";

type SkladKusObsahChildPickerProps = {
  options: SkladKusObsahChildOption[];
  disabled?: boolean;
};

export function SkladKusObsahChildPicker({
  options,
  disabled = false,
}: SkladKusObsahChildPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => {
      const haystack =
        `${option.polozkaNazev} ${option.displayLabel} ${option.stavLabel}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [options, search]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-200">
        Přidat kus (výběr ze seznamu)
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Hledat podle názvu nebo ev. čísla…"
          disabled={disabled}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        />
      </label>
      <select
        name="child_kus_id_select"
        disabled={disabled || filtered.length === 0}
        defaultValue=""
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        size={Math.min(Math.max(filtered.length, 1), 8)}
      >
        <option value="" disabled>
          {filtered.length === 0
            ? "Žádný dostupný kus — upravte hledání nebo použijte scan"
            : "Vyberte kus…"}
        </option>
        {filtered.map((option) => (
          <option key={option.kusId} value={option.kusId}>
            {option.displayLabel} — {option.stavLabel}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500">
        Zobrazeno {filtered.length} z {options.length} dostupných kusů (skladem, ne v case, ne na
        zakázce).
      </p>
    </div>
  );
}
