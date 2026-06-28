"use client";

import { useMemo, useState } from "react";
import SkladPolozkySelectDialog, {
  type SkladPolozkaSelectResult,
} from "@/components/sklad/SkladPolozkySelectDialog";
import { formatMoneyCzk } from "@/lib/payments";
import { applyDiscountFromTargetPrice, formatDiscountPercent } from "@/lib/pricing/discount";
import {
  buildObjednavkaPricingBlock,
  computeObjednavkaPricingBreakdown,
  deriveObjednavkaSetupyFromSestava,
  type ObjednavkaPricingCatalog,
} from "@/lib/client-portal/poptavka-objednavka-pricing";
import type {
  ObjednavkaExtraPolozka,
  ObjednavkaPricingBlock,
  PoptavkaObjednavkaDraftData,
} from "@/lib/client-portal/poptavka-objednavka-types";
import type { PortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-types";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";

type Props = {
  sestava: PoptavkaObjednavkaDraftData["sestava"];
  extraPolozky: ObjednavkaExtraPolozka[];
  pricing: ObjednavkaPricingBlock | null;
  pricingCatalog: ObjednavkaPricingCatalog;
  sestavaKatalog: PortalSestavaKatalog;
  setupsByOblast: PortalSetupsByOblast;
  disabled?: boolean;
  onExtraPolozkyChange: (rows: ObjednavkaExtraPolozka[]) => void;
  onPricingChange: (pricing: ObjednavkaPricingBlock | null) => void;
};

function newLocalId() {
  return `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PoptavkaObjednavkaPricingPanel({
  sestava,
  extraPolozky,
  pricing,
  pricingCatalog,
  sestavaKatalog,
  setupsByOblast,
  disabled,
  onExtraPolozkyChange,
  onPricingChange,
}: Props) {
  const [skladDialogOpen, setSkladDialogOpen] = useState(false);
  const [duplicateKusInfo, setDuplicateKusInfo] = useState<string | null>(null);
  const [pozadovanaInput, setPozadovanaInput] = useState(
    pricing?.pozadovanaCena != null ? String(Math.round(pricing.pozadovanaCena)) : ""
  );
  const [discountError, setDiscountError] = useState<string | null>(null);

  const setupy = useMemo(
    () => deriveObjednavkaSetupyFromSestava(sestava, sestavaKatalog, setupsByOblast),
    [sestava, sestavaKatalog, setupsByOblast]
  );

  const breakdown = useMemo(
    () =>
      computeObjednavkaPricingBreakdown({
        setupy,
        extraPolozky,
        pricingCatalog,
      }),
    [setupy, extraPolozky, pricingCatalog]
  );

  const livePricing = useMemo(
    () =>
      buildObjednavkaPricingBlock({
        setupy,
        extraPolozky,
        pricingCatalog,
        pozadovanaCena: pricing?.pozadovanaCena ?? null,
        previous: pricing,
      }),
    [setupy, extraPolozky, pricingCatalog, pricing]
  );

  function addExtraPolozka(result: SkladPolozkaSelectResult) {
    setDuplicateKusInfo(null);

    if (result.typVyberu === "kus") {
      const existing = extraPolozky.find(
        (row) => row.typVyberu === "kus" && row.skladovyKusId === result.skladovyKusId
      );
      if (existing) {
        setDuplicateKusInfo(`Kus „${result.nazev}“ je už v extra položkách.`);
        return;
      }

      onExtraPolozkyChange([
        ...extraPolozky,
        {
          localId: newLocalId(),
          typVyberu: "kus",
          skladovaPolozkaId: result.skladovaPolozkaId,
          skladovyKusId: result.skladovyKusId,
          nazev: result.nazev,
          polozkaNazev: result.polozkaNazev,
          mnozstvi: 1,
        },
      ]);
      return;
    }

    const existing = extraPolozky.find(
      (row) =>
        row.typVyberu === "polozka" && row.skladovaPolozkaId === result.skladovaPolozkaId
    );

    if (existing) {
      onExtraPolozkyChange(
        extraPolozky.map((item) =>
          item.localId === existing.localId
            ? { ...item, mnozstvi: item.mnozstvi + result.mnozstvi }
            : item
        )
      );
      return;
    }

    onExtraPolozkyChange([
      ...extraPolozky,
      {
        localId: newLocalId(),
        typVyberu: "polozka",
        skladovaPolozkaId: result.skladovaPolozkaId,
        skladovyKusId: null,
        nazev: result.nazev,
        polozkaNazev: null,
        mnozstvi: result.mnozstvi,
      },
    ]);
  }

  function handleApplyDiscount() {
    const pozadovana = Number(pozadovanaInput.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(pozadovana)) {
      setDiscountError("Zadejte platnou požadovanou cenu.");
      return;
    }
    const result = applyDiscountFromTargetPrice(breakdown.vypoctovaCena, pozadovana);
    if (!result.ok) {
      setDiscountError(result.reason);
      return;
    }
    setDiscountError(null);
    onPricingChange({
      ...livePricing,
      pozadovanaCena: pozadovana,
      slevaProcent: result.slevaProcent,
      konecnaCena: result.konecnaCena,
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Extra položky
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Doplňte další skladové položky mimo setupy z konfigurace sestavy. Cena vychází ze sloupce
          „Cena pro akce“ (fakturacni_cena) ve skladu.
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setSkladDialogOpen(true)}
            disabled={disabled}
            className="rounded-xl border border-indigo-500/40 bg-indigo-950/40 px-4 py-2.5 text-sm font-semibold text-indigo-100 hover:bg-indigo-900/50 disabled:opacity-50"
          >
            Vybrat ze skladu
          </button>
        </div>

        <SkladPolozkySelectDialog
          open={skladDialogOpen}
          onClose={() => setSkladDialogOpen(false)}
          onConfirm={addExtraPolozka}
          disabled={disabled}
          confirmLabel="Přidat do extra položek"
        />

        {duplicateKusInfo ? (
          <p className="mt-3 rounded-lg border border-sky-500/30 bg-sky-950/30 px-3 py-2 text-sm text-sky-100">
            {duplicateKusInfo}
          </p>
        ) : null}

        {extraPolozky.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Zatím nejsou přidané extra položky.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {extraPolozky.map((row) => {
              const isKus = row.typVyberu === "kus";
              return (
              <li
                key={row.localId}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 font-medium text-white">
                  {row.nazev}
                  {isKus ? (
                    <span className="font-normal text-slate-400"> — konkrétní kus</span>
                  ) : null}
                  <span className="font-normal text-slate-400"> — {row.mnozstvi} ks</span>
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={row.mnozstvi}
                  disabled={disabled || isKus}
                  readOnly={isKus}
                  onChange={(e) => {
                    const mnozstvi = Math.max(0, Number(e.target.value.replace(",", ".")) || 0);
                    onExtraPolozkyChange(
                      extraPolozky.map((item) =>
                        item.localId === row.localId ? { ...item, mnozstvi } : item
                      )
                    );
                  }}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white disabled:opacity-60 read-only:cursor-default"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onExtraPolozkyChange(extraPolozky.filter((item) => item.localId !== row.localId))
                  }
                  className="text-red-300 hover:text-red-200 disabled:opacity-50"
                >
                  Odebrat
                </button>
              </li>
            );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
          Cenový výpočet
        </h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Výpočtová cena dle skladu
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {formatMoneyCzk(livePricing.vypoctovaCena)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Setupy: {formatMoneyCzk(livePricing.setupCastka)} · Extra:{" "}
              {formatMoneyCzk(livePricing.extraCastka)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Konečná cena pro klienta</p>
            <p className="mt-1 text-xl font-bold text-emerald-100">
              {livePricing.konecnaCena != null
                ? formatMoneyCzk(livePricing.konecnaCena)
                : "—"}
            </p>
            {livePricing.slevaProcent != null ? (
              <p className="mt-1 text-xs text-emerald-200/90">
                Poskytnutá sleva: {formatDiscountPercent(livePricing.slevaProcent)} %
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block min-w-[200px] flex-1 space-y-1">
            <span className="text-xs text-slate-400">Požadovaná výsledná cena (Kč)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={pozadovanaInput}
              onChange={(e) => setPozadovanaInput(e.target.value)}
              disabled={disabled}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            onClick={handleApplyDiscount}
            disabled={disabled || breakdown.vypoctovaCena <= 0}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Aplikovat slevu
          </button>
        </div>

        {discountError ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
            {discountError}
          </p>
        ) : null}

        {livePricing.polozkyBezCeny.length > 0 ? (
          <p className="mt-3 text-sm text-amber-200/90">
            Položky bez ceny pro akci: {livePricing.polozkyBezCeny.join(", ")}
          </p>
        ) : null}

        {setupy.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Setupy z konfigurace ({setupy.length})
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              {setupy.map((row) => (
                <li key={`${row.setupId}-${row.poznamkaKlienta ?? ""}`}>
                  {row.nazev} · {row.mnozstvi}× setup
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function syncPricingHiddenFields(
  form: HTMLFormElement,
  extraPolozky: ObjednavkaExtraPolozka[],
  pricing: ObjednavkaPricingBlock | null
) {
  const extraInput = form.elements.namedItem("extra_polozky_json") as HTMLInputElement | null;
  const pricingInput = form.elements.namedItem("pricing_json") as HTMLInputElement | null;
  if (extraInput) extraInput.value = JSON.stringify(extraPolozky);
  if (pricingInput) pricingInput.value = JSON.stringify(pricing);
}
