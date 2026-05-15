"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import {
  formatDateTime,
  formatNumber,
  formatPrioritaLabel,
  formatTypPoskozeniLabel,
  getEvidencePoskozeniKusLabel,
  isPoskozeniClosed,
  prioritaEvidenceBadgeClassName,
  slugifyCz,
} from "@/lib/sklad/helpers";
import type {
  SkladKusRow,
  SkladPoskozeniRow,
  SkladPrioritaOption,
} from "@/lib/sklad/types";

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-blue-500 bg-blue-600 text-white"
          : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function EvidencePoskozeniClient({
  poskozeni,
  priority,
  jednotka,
}: {
  poskozeni: SkladPoskozeniRow[];
  priority: SkladPrioritaOption[];
  jednotka: string;
}) {
  const router = useRouter();

  const [stav, setStav] = useState<"open" | "closed" | "all">("open");
  const [blokuje, setBlokuje] = useState<"all" | "yes" | "no">("all");
  const [priorita, setPriorita] = useState("all");

  const [kusyById, setKusyById] = useState<
    Record<string, Pick<SkladKusRow, "kus_id" | "poradove_cislo" | "evidencni_cislo">>
  >({});
  const [actionItem, setActionItem] = useState<SkladPoskozeniRow | null>(null);
  const [savingAction, setSavingAction] = useState<"odblokovat" | "uzavrit" | null>(null);

  useEffect(() => {
    const kusIds = Array.from(
      new Set(
        poskozeni
          .map((item) => item.kus_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (kusIds.length === 0) {
      return;
    }

    const loadKusy = async () => {
      const { data, error } = await supabase
        .from(SKLAD_TABLE.skladPolozkyKusy)
        .select("kus_id, poradove_cislo, evidencni_cislo")
        .in("kus_id", kusIds);

      if (error) {
        console.error(error);
        return;
      }

      const map: Record<
        string,
        Pick<SkladKusRow, "kus_id" | "poradove_cislo" | "evidencni_cislo">
      > = {};

      ((data ?? []) as Pick<SkladKusRow, "kus_id" | "poradove_cislo" | "evidencni_cislo">[]).forEach(
        (kus) => {
          map[kus.kus_id] = kus;
        }
      );

      setKusyById(map);
    };

    void loadKusy();
  }, [poskozeni]);

  const filteredPoskozeni = useMemo(() => {
    return poskozeni.filter((item) => {
      const jeUzavrene = isPoskozeniClosed(item);

      if (stav === "open" && jeUzavrene) return false;
      if (stav === "closed" && !jeUzavrene) return false;

      if (blokuje === "yes" && !item.blokuje_pouziti) return false;
      if (blokuje === "no" && item.blokuje_pouziti) return false;

      if (priorita !== "all" && slugifyCz(item.priorita ?? "") !== priorita) {
        return false;
      }

      return true;
    });
  }, [poskozeni, stav, blokuje, priorita]);

  function openActionDialog(item: SkladPoskozeniRow) {
    setActionItem(item);
  }

  function closeActionDialog() {
    if (savingAction) return;

    setActionItem(null);
  }

  async function odblokovatZachovatHlaseni() {
    if (!actionItem) return;

    setSavingAction("odblokovat");

    const { error } = await supabase
      .from(SKLAD_TABLE.hlaseniPoskozeni)
      .update({
        blokuje_pouziti: false,
        stav_reseni: "otevrene",
        datum_uzavreni: null,
      })
      .eq("poskozeni_id", actionItem.poskozeni_id);

    setSavingAction(null);

    if (error) {
      alert(error.message);
      return;
    }

    setActionItem(null);
    router.refresh();
  }

  async function opravenoUzavrit() {
    if (!actionItem) return;

    setSavingAction("uzavrit");

    const { error } = await supabase
      .from(SKLAD_TABLE.hlaseniPoskozeni)
      .update({
        blokuje_pouziti: false,
        stav_reseni: "uzavrene",
        datum_uzavreni: new Date().toISOString(),
      })
      .eq("poskozeni_id", actionItem.poskozeni_id);

    setSavingAction(null);

    if (error) {
      alert(error.message);
      return;
    }

    setActionItem(null);
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterButton active={stav === "open"} onClick={() => setStav("open")}>
          Otevřené
        </FilterButton>
        <FilterButton active={stav === "closed"} onClick={() => setStav("closed")}>
          Uzavřené
        </FilterButton>
        <FilterButton active={stav === "all"} onClick={() => setStav("all")}>
          Vše
        </FilterButton>

        <FilterButton active={blokuje === "all"} onClick={() => setBlokuje("all")}>
          Všechna použití
        </FilterButton>
        <FilterButton active={blokuje === "yes"} onClick={() => setBlokuje("yes")}>
          Jen blokující
        </FilterButton>
        <FilterButton active={blokuje === "no"} onClick={() => setBlokuje("no")}>
          Jen neblokující
        </FilterButton>

        <FilterButton active={priorita === "all"} onClick={() => setPriorita("all")}>
          Všechny priority
        </FilterButton>

        {priority.map((item) => {
          const prioritySlug = slugifyCz(item.nazev);

          return (
            <FilterButton
              key={item.priorita_id}
              active={priorita === prioritySlug}
              onClick={() => setPriorita(prioritySlug)}
            >
              {item.nazev}
            </FilterButton>
          );
        })}
      </div>

      {filteredPoskozeni.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-4 py-8 text-center text-sm text-slate-400">
          Tomuto filtru nic neodpovídá.
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredPoskozeni.map((item) => {
            const jeUzavrene = isPoskozeniClosed(item);
            const isSaving = actionItem?.poskozeni_id === item.poskozeni_id && !!savingAction;
            const kusLabel = getEvidencePoskozeniKusLabel(item, kusyById);

            return (
              <div
                key={item.poskozeni_id}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 text-base font-semibold text-white">
                      {kusLabel}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-amber-800 px-2.5 py-1 text-xs font-semibold text-white">
                        {formatNumber(item.pocet_kusu)} {jednotka}
                      </span>

                      <span className="rounded-full bg-blue-900 px-2.5 py-1 text-xs font-semibold text-blue-100">
                        {formatTypPoskozeniLabel(item.typ_poskozeni)}
                      </span>

                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          prioritaEvidenceBadgeClassName(item.priorita),
                        ].join(" ")}
                      >
                        {formatPrioritaLabel(item.priorita)}
                      </span>

                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          jeUzavrene
                            ? "bg-emerald-900 text-emerald-100"
                            : "bg-rose-900 text-rose-100",
                        ].join(" ")}
                      >
                        {jeUzavrene ? "uzavřeno" : "otevřené"}
                      </span>

                      {item.blokuje_pouziti && !jeUzavrene ? (
                        <span className="rounded-full bg-red-700 px-2.5 py-1 text-xs font-semibold text-white">
                          blokuje použití
                        </span>
                      ) : null}

                      {!item.blokuje_pouziti && !jeUzavrene ? (
                        <span className="rounded-full bg-emerald-900 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                          neblokuje použití
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                      <div>
                        <span className="text-slate-500">Nahlášeno:</span>{" "}
                        {formatDateTime(item.datum_nahlaseni)}
                      </div>

                      <div>
                        <span className="text-slate-500">Uzavřeno:</span>{" "}
                        {formatDateTime(item.datum_uzavreni)}
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-slate-200">
                      {item.popis?.trim() ? item.popis : "Bez popisu"}
                    </div>
                  </div>

                  {!jeUzavrene ? (
                    <div className="flex shrink-0 items-start">
                      <button
                        type="button"
                        onClick={() => openActionDialog(item)}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-default disabled:opacity-70"
                      >
                        {isSaving ? "Ukládám..." : "Vyřešit"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!actionItem} onClose={closeActionDialog} title="Vyřešit hlášení poškození">
        {actionItem ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
              <div className="font-semibold text-white">
                {getEvidencePoskozeniKusLabel(actionItem, kusyById)}
              </div>
              <div className="mt-1 text-slate-400">
                {formatNumber(actionItem.pocet_kusu)} {jednotka} ·{" "}
                {formatTypPoskozeniLabel(actionItem.typ_poskozeni)} ·{" "}
                {formatPrioritaLabel(actionItem.priorita)}
              </div>
              <div className="mt-3 text-slate-200">
                {actionItem.popis?.trim() ? actionItem.popis : "Bez popisu"}
              </div>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => void odblokovatZachovatHlaseni()}
                disabled={!!savingAction}
                className="rounded-xl border border-amber-700 bg-amber-900 px-4 py-4 text-left text-sm text-white transition hover:bg-amber-800 disabled:opacity-60"
              >
                <span className="block font-semibold">
                  Stále poškozené, ale odblokovat
                </span>
                <span className="mt-1 block text-amber-100/80">
                  Hlášení zůstane otevřené v evidenci poškození, ale nebude blokovat použití položky.
                </span>
              </button>

              <button
                type="button"
                onClick={() => void opravenoUzavrit()}
                disabled={!!savingAction}
                className="rounded-xl border border-emerald-600 bg-emerald-700 px-4 py-4 text-left text-sm text-white transition hover:bg-emerald-600 disabled:opacity-60"
              >
                <span className="block font-semibold">Opraveno, uzavřít</span>
                <span className="mt-1 block text-emerald-100/80">
                  Hlášení se uzavře, nastaví se datum uzavření a položka nebude blokovaná.
                </span>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeActionDialog}
                disabled={!!savingAction}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                Zrušit
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
