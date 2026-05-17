"use client";

import { useRouter } from "next/navigation";
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
    datumPorizeni: kus.datum_porizeni ?? "",
    odpisovePasmoId: kus.odpisove_pasmo_id ?? "",
  };
}

function fieldClassName(extra = "") {
  return [
    "h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(date);
}

export function SkladKusAssetFields({ kus, odpisovaPasma }: Props) {
  const router = useRouter();
  const [state, setState] = useState<AssetState>(() => toInitialState(kus));
  const [savedState, setSavedState] = useState<AssetState>(() => toInitialState(kus));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedBand = useMemo(
    () => odpisovaPasma.find((item) => item.odpisove_pasmo_id === state.odpisovePasmoId) ?? null,
    [odpisovaPasma, state.odpisovePasmoId]
  );
  const depreciation = calculateLinearDepreciation({
    purchaseValue: state.porizovaciHodnota,
    purchaseDate: state.datumPorizeni,
    depreciationMonths: selectedBand?.pocet_mesicu,
  });

  function save(nextState: AssetState) {
    if (isPending || JSON.stringify(nextState) === JSON.stringify(savedState)) return;

    const formData = new FormData();
    formData.set("kus_id", kus.kus_id);
    formData.set("porizovaci_hodnota", nextState.porizovaciHodnota);
    formData.set("datum_porizeni", nextState.datumPorizeni);
    formData.set("odpisove_pasmo_id", nextState.odpisovePasmoId);

    startTransition(async () => {
      try {
        await updateSkladKusAssetValueAction(formData);
        setSavedState(nextState);
        setError(null);
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Uložení odpisů se nepovedlo.");
      }
    });
  }

  function patch(nextPatch: Partial<AssetState>, autosave = false) {
    const nextState = { ...state, ...nextPatch };
    setState(nextState);
    if (autosave) save(nextState);
  }

  function handleEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.currentTarget.blur();
  }

  return (
    <>
      <div className="flex items-center px-2">
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
      </div>

      <div className="flex items-center px-2">
        <input
          aria-label="Datum pořízení kusu"
          type="date"
          value={state.datumPorizeni}
          onChange={(event) => patch({ datumPorizeni: event.currentTarget.value }, true)}
          onBlur={() => save(state)}
          disabled={isPending}
          className={fieldClassName()}
          title={formatDate(state.datumPorizeni)}
        />
      </div>

      <div className="flex items-center px-2">
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
      </div>

      <div className="flex items-center px-2">
        <span
          className={[
            "flex h-10 w-full items-center justify-center rounded-lg border px-2 text-center text-xs font-black",
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
        <div className="col-span-full rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-100">
          {error}
        </div>
      ) : null}
    </>
  );
}
