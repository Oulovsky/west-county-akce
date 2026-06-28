"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SpravaCaseMetadata } from "@/lib/sklad/caseKus";
import { EMPTY_SPRAVA_CASE_METADATA } from "@/lib/sklad/caseKus";
import type { SpravaVybranaPolozka, SpravaVybranyKus } from "@/lib/sklad/types";

type SpravaSelectionContextValue = {
  caseMetadata: SpravaCaseMetadata;
  setCaseMetadata: (metadata: SpravaCaseMetadata) => void;
  selectedPolozka: SpravaVybranaPolozka | null;
  selectedKusy: Map<string, SpravaVybranyKus>;
  selectedKusList: SpravaVybranyKus[];
  hasSelection: boolean;
  isKusSelected: (kusId: string) => boolean;
  isPolozkaSelected: (polozkaId: string) => boolean;
  togglePolozka: (entry: SpravaVybranaPolozka) => void;
  toggleKus: (entry: SpravaVybranyKus) => void;
  clearSelection: () => void;
  onAfterKusMutation: () => void;
  registerAfterKusMutation: (fn: () => void) => void;
};

const SpravaSelectionContext =
  createContext<SpravaSelectionContextValue | null>(null);

export function SpravaKusSelectionProvider({
  children,
  singleKusSelection = false,
}: {
  children: ReactNode;
  /** V modalu objednávky — najednou jen jeden konkrétní kus. */
  singleKusSelection?: boolean;
}) {
  const [caseMetadata, setCaseMetadata] = useState<SpravaCaseMetadata>(
    EMPTY_SPRAVA_CASE_METADATA
  );
  const [selectedPolozka, setSelectedPolozka] =
    useState<SpravaVybranaPolozka | null>(null);
  const [selectedKusy, setSelectedKusy] = useState<
    Map<string, SpravaVybranyKus>
  >(() => new Map());
  const [afterMutation, setAfterMutation] = useState<(() => void) | null>(null);

  const registerAfterKusMutation = useCallback((fn: () => void) => {
    setAfterMutation(() => fn);
  }, []);

  const onAfterKusMutation = useCallback(() => {
    afterMutation?.();
  }, [afterMutation]);

  const clearSelection = useCallback(() => {
    setSelectedPolozka(null);
    setSelectedKusy(new Map());
  }, []);

  const togglePolozka = useCallback((entry: SpravaVybranaPolozka) => {
    setSelectedKusy(new Map());
    setSelectedPolozka((prev) =>
      prev?.skladovaPolozkaId === entry.skladovaPolozkaId ? null : entry
    );
  }, []);

  const toggleKus = useCallback(
    (entry: SpravaVybranyKus) => {
      setSelectedPolozka(null);
      setSelectedKusy((prev) => {
        if (singleKusSelection) {
          if (prev.has(entry.kusId)) return new Map();
          return new Map([[entry.kusId, entry]]);
        }
        const next = new Map(prev);
        if (next.has(entry.kusId)) {
          next.delete(entry.kusId);
        } else {
          next.set(entry.kusId, entry);
        }
        return next;
      });
    },
    [singleKusSelection]
  );

  const isKusSelected = useCallback(
    (kusId: string) => selectedKusy.has(kusId),
    [selectedKusy]
  );

  const isPolozkaSelected = useCallback(
    (polozkaId: string) => selectedPolozka?.skladovaPolozkaId === polozkaId,
    [selectedPolozka]
  );

  const selectedKusList = useMemo(
    () => Array.from(selectedKusy.values()),
    [selectedKusy]
  );

  const hasSelection =
    selectedPolozka !== null || selectedKusList.length > 0;

  const value = useMemo(
    () => ({
      caseMetadata,
      setCaseMetadata,
      selectedPolozka,
      selectedKusy,
      selectedKusList,
      hasSelection,
      isKusSelected,
      isPolozkaSelected,
      togglePolozka,
      toggleKus,
      clearSelection,
      onAfterKusMutation,
      registerAfterKusMutation,
    }),
    [
      caseMetadata,
      selectedPolozka,
      selectedKusy,
      selectedKusList,
      hasSelection,
      isKusSelected,
      isPolozkaSelected,
      togglePolozka,
      toggleKus,
      clearSelection,
      onAfterKusMutation,
      registerAfterKusMutation,
    ]
  );

  return (
    <SpravaSelectionContext.Provider value={value}>
      {children}
    </SpravaSelectionContext.Provider>
  );
}

export function useSpravaKusSelection() {
  const ctx = useContext(SpravaSelectionContext);
  if (!ctx) {
    throw new Error(
      "useSpravaKusSelection musí být uvnitř SpravaKusSelectionProvider"
    );
  }
  return ctx;
}
