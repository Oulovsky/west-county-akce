"use client";

import { type KeyboardEvent, useMemo, useState, useTransition } from "react";
import { updateSkladKusAssetValueAction } from "@/app/sklad/kus/[kus_id]/actions";
import { calculateLinearDepreciation } from "@/lib/sklad/depreciation";
import { formatMoney } from "@/lib/sklad/helpers";
import type { SkladKusRow, SkladOdpisovePasmo } from "@/lib/sklad/types";

type Props = {
  kus: SkladKusRow;
  odpisovaPasma: SkladOdpisovePasmo[];
};

type AssetState = {
  porizovaciHodnota: string;
  datumPorizeni: string;
  odpisovePasmoId: string;
};

function toInitialState(kus: SkladKusRow): AssetState {
  return {
    porizovaciHodnota: kus.porizovaci_hodnota == null ? "" : String(kus.porizovaci_hodnota),
    datumPorizeni: isoDateToCzech(kus.datum_porizeni),
    odpisovePasmoId: kus.odpisove_pasmo_id ?? "",
  };
}

function fieldClassName(extra = "") {
  return [
    "h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDate(value: string) {
  if (!value) return "—";
  const parsed = czechDateToIso(value);
  return parsed.ok ? value : "—";
}

function formatCzechDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function isoDateToCzech(value: string | null | undefined) {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function czechDateToIso(value: string) {
  const formatted = formatCzechDateInput(value);
  if (!formatted) return { ok: true as const, iso: "" };

  const match = formatted.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return { ok: false as const, iso: "" };

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { ok: false as const, iso: "" };
  }

  return {
    ok: true as const,
    iso: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

export function SkladKusAssetFields({ kus, odpisovaPasma }: Props) {
  const [state, setState] = useState<AssetState>(() => toInitialState(kus));
  const [savedState, setSavedState] = useState<AssetState>(() => toInitialState(kus));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedBand = useMemo(
    () => odpisovaPasma.find((item) => item.odpisove_pasmo_id === state.odpisovePasmoId) ?? null,
    [odpisovaPasma, state.odpisovePasmoId]
  );
  const parsedPurchaseDate = czechDateToIso(state.datumPorizeni);
  const depreciation = calculateLinearDepreciation({
    purchaseValue: state.porizovaciHodnota,
    purchaseDate: parsedPurchaseDate.ok ? parsedPurchaseDate.iso : null,
    depreciationMonths: selectedBand?.pocet_mesicu,
  });

  function save(nextState: AssetState, options: { showDateError?: boolean } = {}) {
    if (isPending || JSON.stringify(nextState) === JSON.stringify(savedState)) return;
    const parsedDate = czechDateToIso(nextState.datumPorizeni);
    if (!parsedDate.ok) {
      if (options.showDateError) {
        setError("Datum pořízení zadejte kompletně ve formátu dd.mm.rrrr, např. 08.11.2025.");
      }
      return;
    }

    const formData = new FormData();
    formData.set("kus_id", kus.kus_id);
    formData.set("porizovaci_hodnota", nextState.porizovaciHodnota);
    formData.set("datum_porizeni", parsedDate.iso);
    formData.set("odpisove_pasmo_id", nextState.odpisovePasmoId);

    startTransition(async () => {
      try {
        await updateSkladKusAssetValueAction(formData);
        setSavedState(nextState);
        setError(null);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Uložení odpisů se nepovedlo.");
      }
    });
  }

  function patch(nextPatch: Partial<AssetState>, autosave = false) {
    const nextState = { ...state, ...nextPatch };
    setState(nextState);
    setError(null);
    if (autosave) save(nextState);
  }

  function handleEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.currentTarget.blur();
  }

  return (
    <div className="grid gap-3 md:grid-cols-[110px_125px_150px_120px]">
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hodnota</span>
        <input
          aria-label="Pořizovací hodnota kusu"
          value={state.porizovaciHodnota}
          onChange={(event) => patch({ porizovaciHodnota: event.currentTarget.value })}
          onBlur={() => save(state)}
          onKeyDown={handleEnter}
          inputMode="decimal"
          disabled={isPending}
          className={fieldClassName("text-right")}
          placeholder="—"
        />
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pořízeno</span>
        <input
          aria-label="Datum pořízení kusu"
          type="text"
          value={state.datumPorizeni}
          onChange={(event) => patch({ datumPorizeni: formatCzechDateInput(event.currentTarget.value) })}
          onBlur={(event) =>
            save(
              { ...state, datumPorizeni: formatCzechDateInput(event.currentTarget.value) },
              { showDateError: true }
            )
          }
          onKeyDown={handleEnter}
          disabled={isPending}
          className={fieldClassName()}
          inputMode="numeric"
          placeholder="dd.mm.rrrr"
          title={formatDate(state.datumPorizeni)}
        />
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Odpisy</span>
        <select
          aria-label="Odpisové pásmo kusu"
          value={state.odpisovePasmoId}
          onChange={(event) => patch({ odpisovePasmoId: event.currentTarget.value }, true)}
          disabled={isPending}
          className={fieldClassName()}
        >
          <option value="">Bez pásma</option>
          {odpisovaPasma.map((pasmo) => (
            <option key={pasmo.odpisove_pasmo_id} value={pasmo.odpisove_pasmo_id}>
              {pasmo.nazev}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Současná hodnota</span>
        <span
          className={[
            "mt-2 flex h-9 w-full items-center justify-center rounded-lg border px-2 text-center text-xs font-black",
            depreciation.ok
              ? "border-emerald-800 bg-emerald-950 text-emerald-100"
              : "border-slate-700 bg-slate-900 text-slate-400",
          ].join(" ")}
          title={depreciation.ok ? "Lineární současná hodnota" : "Nelze spočítat"}
        >
          {depreciation.ok ? `${formatMoney(depreciation.currentValue)} Kč` : "—"}
        </span>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-100 md:col-span-4">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function SkladKusAssetSummary({ kus, odpisovaPasma }: Props) {
  const selectedBand =
    odpisovaPasma.find((item) => item.odpisove_pasmo_id === kus.odpisove_pasmo_id) ?? null;
  const depreciation = calculateLinearDepreciation({
    purchaseValue: kus.porizovaci_hodnota,
    purchaseDate: kus.datum_porizeni,
    depreciationMonths: selectedBand?.pocet_mesicu,
  });

  const purchaseValue = kus.porizovaci_hodnota == null ? null : `${formatMoney(kus.porizovaci_hodnota)} Kč`;
  const currentValue = depreciation.ok ? `${formatMoney(depreciation.currentValue)} Kč` : "—";
  const bandLabel = selectedBand?.nazev ?? "bez pásma";
  const summary = purchaseValue ? `${purchaseValue} / ${bandLabel} / nyní ${currentValue}` : "—";

  return (
    <span
      className={[
        "flex min-h-9 w-full min-w-0 items-center justify-center rounded-lg border px-2 text-center text-[10px] font-bold leading-tight",
        purchaseValue ? "border-emerald-800 bg-emerald-950/60 text-emerald-100" : "border-slate-700 bg-slate-900 text-slate-400",
      ].join(" ")}
      title={summary}
    >
      <span className="whitespace-normal break-words">{summary}</span>
    </span>
  );
}
