"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { KusQrActionMenu } from "@/components/sklad/KusQrActionMenu";
import {
  deleteSpravaKus,
  pridatKusDoPolozky,
  vyjmoutKusZCase,
} from "@/lib/sklad/spravaKusActions";
import type { SpravaVybranaPolozka, SpravaVybranyKus } from "@/lib/sklad/types";
import { supabase } from "@/lib/supabase";
import { useSpravaKusSelection } from "./SpravaKusSelectionContext";
import { SpravaVlozitKusDoCaseModal } from "./SpravaVlozitKusDoCaseModal";

const PANEL_BTN =
  "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-45";
const PANEL_BTN_PRIMARY = `${PANEL_BTN} border-blue-700 bg-blue-800 text-white hover:bg-blue-700`;
const PANEL_BTN_NEUTRAL = `${PANEL_BTN} border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800`;
const PANEL_BTN_DANGER = `${PANEL_BTN} border-red-800 bg-red-950 text-red-100 hover:bg-red-900`;

type PanelActions = {
  showDetail: boolean;
  detailHref: string | null;
  detailDisabled: boolean;
  detailLabel: string;
  showQr: boolean;
  qrDisabled: boolean;
  showPridatKus: boolean;
  showVlozit: boolean;
  showVyjmout: boolean;
  showSmazat: boolean;
};

function computeKusPanelActions(
  kusList: SpravaVybranyKus[]
): PanelActions {
  if (kusList.length === 0) {
    return {
      showDetail: false,
      detailHref: null,
      detailDisabled: true,
      detailLabel: "Detail kusu",
      showQr: false,
      qrDisabled: true,
      showPridatKus: false,
      showVlozit: false,
      showVyjmout: false,
      showSmazat: false,
    };
  }

  if (kusList.length === 1) {
    const k = kusList[0];
    return {
      showDetail: true,
      detailHref: `/sklad/kus/${k.kusId}`,
      detailDisabled: false,
      detailLabel: "Detail kusu",
      showQr: true,
      qrDisabled: false,
      showPridatKus: k.kind === "bezny" || k.kind === "case",
      showVlozit: k.kind === "case",
      showVyjmout: k.kind === "child_v_case",
      showSmazat: true,
    };
  }

  const allChild = kusList.every((k) => k.kind === "child_v_case");

  return {
    showDetail: true,
    detailHref: null,
    detailDisabled: true,
    detailLabel: "Detail kusu",
    showQr: true,
    qrDisabled: true,
    showPridatKus: false,
    showVlozit: false,
    showVyjmout: allChild,
    showSmazat: true,
  };
}

function computePolozkaPanelActions(
  polozka: SpravaVybranaPolozka
): PanelActions {
  return {
    showDetail: true,
    detailHref: `/sklad/${polozka.skladovaPolozkaId}`,
    detailDisabled: false,
    detailLabel: "Detail položky",
    showQr: false,
    qrDisabled: true,
    showPridatKus: true,
    showVlozit: false,
    showVyjmout: false,
    showSmazat: false,
  };
}

type Props = {
  onAddPolozka: () => void;
  onAddCase: () => void;
};

export function SpravaActionPanel({ onAddPolozka, onAddCase }: Props) {
  const {
    hasSelection,
    selectedPolozka,
    selectedKusList,
    clearSelection,
    onAfterKusMutation,
  } = useSpravaKusSelection();

  const [busy, setBusy] = useState(false);
  const [vlozitOpen, setVlozitOpen] = useState(false);

  const actions = useMemo(() => {
    if (selectedPolozka) {
      return computePolozkaPanelActions(selectedPolozka);
    }
    return computeKusPanelActions(selectedKusList);
  }, [selectedPolozka, selectedKusList]);

  const singleKus =
    selectedKusList.length === 1 ? selectedKusList[0] : null;

  const selectionLabel = useMemo(() => {
    if (selectedPolozka) {
      return selectedPolozka.nazev;
    }
    if (selectedKusList.length === 1 && singleKus) {
      return singleKus.label;
    }
    if (selectedKusList.length > 1) {
      return null;
    }
    return null;
  }, [selectedPolozka, selectedKusList.length, singleKus]);

  async function handleSmazat() {
    if (selectedKusList.length === 0) return;

    const message =
      selectedKusList.length === 1
        ? "Chcete odstranit položku?"
        : `Chcete odstranit ${selectedKusList.length} vybraných kusů?`;

    if (!window.confirm(message)) return;

    setBusy(true);
    const errors: string[] = [];

    for (const entry of selectedKusList) {
      const result = await deleteSpravaKus(
        supabase,
        entry.kusId,
        entry.skladovaPolozkaId
      );
      if (!result.ok) {
        errors.push(`${entry.label}: ${result.error}`);
      }
    }

    setBusy(false);

    if (errors.length > 0) {
      window.alert(errors.join("\n"));
    } else {
      clearSelection();
      onAfterKusMutation();
    }
  }

  async function handleVyjmout() {
    if (selectedKusList.length === 0) return;

    setBusy(true);
    const errors: string[] = [];

    for (const entry of selectedKusList) {
      if (entry.kind !== "child_v_case") continue;
      const result = await vyjmoutKusZCase(supabase, entry.kusId);
      if (!result.ok) {
        errors.push(`${entry.label}: ${result.error}`);
      }
    }

    setBusy(false);

    if (errors.length > 0) {
      window.alert(errors.join("\n"));
    } else {
      clearSelection();
      onAfterKusMutation();
    }
  }

  async function handlePridatKus() {
    const polozkaId =
      selectedPolozka?.skladovaPolozkaId ??
      singleKus?.skladovaPolozkaId;
    const polozkaNazev =
      selectedPolozka?.nazev ?? singleKus?.polozkaNazev;

    if (!polozkaId || !polozkaNazev) return;

    setBusy(true);
    const result = await pridatKusDoPolozky(
      supabase,
      polozkaId,
      polozkaNazev
    );
    setBusy(false);

    if (!result.ok) {
      window.alert(result.error);
      return;
    }

    clearSelection();
    onAfterKusMutation();
  }

  return (
    <>
      <section
        aria-label="Akční panel správy skladu"
        className={[
          "rounded-xl border px-4 py-3 transition-colors",
          hasSelection
            ? "border-blue-800/60 bg-blue-950/20"
            : "border-slate-800 bg-slate-950/50",
        ].join(" ")}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Akční panel
            </h3>

            {!hasSelection ? (
              <p className="text-sm text-slate-400">
                Vyber kus nebo položku ve stromu skladu, nebo vytvoř novou
                položku / case.
              </p>
            ) : selectionLabel ? (
              <div className="space-y-0.5">
                <p className="text-xs text-slate-500">Vybráno:</p>
                <p
                  className="truncate text-sm font-medium text-white"
                  title={selectionLabel}
                >
                  {selectionLabel}
                </p>
                {singleKus?.kind === "child_v_case" &&
                singleKus.parentCaseLabel ? (
                  <p className="text-xs text-slate-400">
                    V case: {singleKus.parentCaseLabel}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-200">
                Vybráno kusů:{" "}
                <span className="font-semibold text-white">
                  {selectedKusList.length}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!hasSelection ? (
              <>
                <button
                  type="button"
                  onClick={onAddPolozka}
                  className={PANEL_BTN_PRIMARY}
                >
                  Přidat položku
                </button>
                <button
                  type="button"
                  onClick={onAddCase}
                  className={PANEL_BTN_NEUTRAL}
                >
                  Přidat case
                </button>
              </>
            ) : (
              <>
                {actions.showDetail ? (
                  actions.detailHref && !actions.detailDisabled ? (
                    <Link href={actions.detailHref} className={PANEL_BTN_PRIMARY}>
                      {actions.detailLabel}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className={PANEL_BTN_PRIMARY}
                      title={
                        selectedKusList.length > 1
                          ? "Detail je dostupný jen pro jeden výběr"
                          : undefined
                      }
                    >
                      {actions.detailLabel}
                    </button>
                  )
                ) : null}

                {actions.showQr ? (
                  singleKus && !actions.qrDisabled ? (
                    <KusQrActionMenu
                      kusId={singleKus.kusId}
                      triggerLabel="QR / štítek"
                      triggerClassName={PANEL_BTN_NEUTRAL}
                      menuVariant="sprava"
                    />
                  ) : (
                    <button
                      type="button"
                      disabled
                      className={PANEL_BTN_NEUTRAL}
                      title="Hromadný tisk zatím není k dispozici"
                    >
                      QR / štítek
                    </button>
                  )
                ) : null}

                {actions.showPridatKus ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handlePridatKus()}
                    className={PANEL_BTN_NEUTRAL}
                  >
                    Přidat kus do této položky
                  </button>
                ) : null}

                {actions.showVlozit && singleKus ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setVlozitOpen(true)}
                    className={PANEL_BTN_NEUTRAL}
                  >
                    Vložit kus do case
                  </button>
                ) : null}

                {actions.showVyjmout ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleVyjmout()}
                    className={PANEL_BTN_NEUTRAL}
                  >
                    Vyjmout z case
                  </button>
                ) : null}

                {actions.showSmazat ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSmazat()}
                    className={PANEL_BTN_DANGER}
                  >
                    Smazat
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={busy}
                  onClick={clearSelection}
                  className={`${PANEL_BTN} border-transparent text-slate-400 hover:text-slate-200`}
                >
                  Zrušit výběr
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {singleKus && singleKus.kind === "case" ? (
        <SpravaVlozitKusDoCaseModal
          open={vlozitOpen}
          onClose={() => setVlozitOpen(false)}
          parentCaseKusId={singleKus.kusId}
          parentCaseLabel={singleKus.label}
          onSuccess={() => {
            setVlozitOpen(false);
            clearSelection();
            onAfterKusMutation();
          }}
        />
      ) : null}
    </>
  );
}
