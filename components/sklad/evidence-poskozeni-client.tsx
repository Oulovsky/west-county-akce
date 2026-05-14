"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";

type PoskozeniRow = {
  poskozeni_id: string;
  skladova_polozka_id: string;
  kus_id: string | null;
  zakazka_id: string | null;
  pocet_kusu: number | string;
  popis: string | null;
  typ_poskozeni: string | null;
  priorita: string | null;
  blokuje_pouziti: boolean;
  stav_reseni: string;
  datum_nahlaseni: string;
  datum_uzavreni: string | null;
};

type PrioritaOption = {
  priorita_id: string;
  nazev: string;
  poradi: number | null;
};

type KusInfo = {
  kus_id: string;
  poradove_cislo: number;
  evidencni_cislo: string | null;
};

function slugifyCz(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.NumberFormat("cs-CZ").format(parsed);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatTypPoskozeni(value: string | null | undefined) {
  const normalized = slugifyCz(value ?? "");

  switch (normalized) {
    case "mechanicke":
      return "mechanické";
    case "elektricke":
      return "elektrické";
    case "vizualni":
      return "vizuální";
    case "jine":
      return "jiné";
    default:
      return value?.trim() || "bez typu";
  }
}

function formatPriorita(value: string | null | undefined) {
  const normalized = slugifyCz(value ?? "");

  switch (normalized) {
    case "nizka":
      return "nízká";
    case "stredni":
      return "střední";
    case "vysoka":
      return "vysoká";
    case "kriticka":
      return "kritická";
    default:
      return value?.trim() || "bez priority";
  }
}

function getPriorityClasses(value: string | null | undefined) {
  const normalized = slugifyCz(value ?? "");

  switch (normalized) {
    case "kriticka":
      return "bg-red-600 text-white";
    case "vysoka":
      return "bg-orange-500 text-white";
    case "stredni":
      return "bg-yellow-400 text-slate-950";
    case "nizka":
      return "bg-slate-500 text-white";
    default:
      return "bg-slate-600 text-white";
  }
}

function isClosed(item: PoskozeniRow) {
  const stavReseni = slugifyCz(item.stav_reseni ?? "");

  return (
    Boolean(item.datum_uzavreni) ||
    ["uzavreno", "uzavrene", "vyreseno", "closed"].includes(stavReseni)
  );
}

function getKusLabel(item: PoskozeniRow, kusyById: Record<string, KusInfo>) {
  if (!item.kus_id) return "bez konkrétního kusu";

  const kus = kusyById[item.kus_id];

  if (!kus) return `Kus ${item.kus_id}`;

  return kus.evidencni_cislo?.trim()
    ? kus.evidencni_cislo
    : `Kus #${kus.poradove_cislo}`;
}

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
  poskozeni: PoskozeniRow[];
  priority: PrioritaOption[];
  jednotka: string;
}) {
  const router = useRouter();

  const [stav, setStav] = useState<"open" | "closed" | "all">("open");
  const [blokuje, setBlokuje] = useState<"all" | "yes" | "no">("all");
  const [priorita, setPriorita] = useState("all");

  const [kusyById, setKusyById] = useState<Record<string, KusInfo>>({});
  const [actionItem, setActionItem] = useState<PoskozeniRow | null>(null);
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
      setKusyById({});
      return;
    }

    const loadKusy = async () => {
      const { data, error } = await supabase
        .from("sklad_polozky_kusy")
        .select("kus_id, poradove_cislo, evidencni_cislo")
        .in("kus_id", kusIds);

      if (error) {
        console.error(error);
        return;
      }

      const map: Record<string, KusInfo> = {};

      ((data ?? []) as KusInfo[]).forEach((kus) => {
        map[kus.kus_id] = kus;
      });

      setKusyById(map);
    };

    void loadKusy();
  }, [poskozeni]);

  const filteredPoskozeni = useMemo(() => {
    return poskozeni.filter((item) => {
      const jeUzavrene = isClosed(item);

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

  function openActionDialog(item: PoskozeniRow) {
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
      .from("hlaseni_poskozeni")
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
      .from("hlaseni_poskozeni")
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
            const jeUzavrene = isClosed(item);
            const isSaving = actionItem?.poskozeni_id === item.poskozeni_id && !!savingAction;
            const kusLabel = getKusLabel(item, kusyById);

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
                        {formatTypPoskozeni(item.typ_poskozeni)}
                      </span>

                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          getPriorityClasses(item.priorita),
                        ].join(" ")}
                      >
                        {formatPriorita(item.priorita)}
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
                {getKusLabel(actionItem, kusyById)}
              </div>
              <div className="mt-1 text-slate-400">
                {formatNumber(actionItem.pocet_kusu)} {jednotka} · {formatTypPoskozeni(actionItem.typ_poskozeni)} · {formatPriorita(actionItem.priorita)}
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
                <span className="block font-semibold">
                  Opraveno, uzavřít
                </span>
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