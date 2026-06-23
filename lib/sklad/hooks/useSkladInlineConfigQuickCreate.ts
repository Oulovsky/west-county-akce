"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  createInlineJednotka,
  createInlineKategorie,
  createInlinePodkategorie,
  createInlineSkladBlok,
} from "@/lib/sklad/inlineConfigCreate";
import { queryJednotkySkladuFull } from "@/lib/sklad/queries";
import type {
  SkladBlok,
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
} from "@/lib/sklad/types";

export type SkladConfigQuickCreateHandler = (
  name: string
) => Promise<{ error?: string } | void>;

type SelectionSetters = {
  blokId: string;
  kategorieId: string;
  setBlokId: (value: string) => void;
  setKategorieId: (value: string) => void;
  setPodkategorieId: (value: string) => void;
  setJednotka: (value: string) => void;
};

type Options = {
  bloky: SkladBlok[];
  kategorie: SkladKategorie[];
  podkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  selection: SelectionSetters;
  onAfterCreate?: () => void | Promise<void>;
};

export function useSkladInlineConfigQuickCreate({
  bloky: blokyProp,
  kategorie: kategorieProp,
  podkategorie: podkategorieProp,
  jednotky: jednotkyProp,
  selection,
  onAfterCreate,
}: Options) {
  const [bloky, setBloky] = useState(blokyProp);
  const [kategorie, setKategorie] = useState(kategorieProp);
  const [podkategorie, setPodkategorie] = useState(podkategorieProp);
  const [jednotky, setJednotky] = useState(jednotkyProp);

  useEffect(() => {
    setBloky(blokyProp);
  }, [blokyProp]);

  useEffect(() => {
    setKategorie(kategorieProp);
  }, [kategorieProp]);

  useEffect(() => {
    setPodkategorie(podkategorieProp);
  }, [podkategorieProp]);

  useEffect(() => {
    setJednotky(jednotkyProp);
  }, [jednotkyProp]);

  const onQuickCreateBlok: SkladConfigQuickCreateHandler = useCallback(
    async (nazev) => {
      const result = await createInlineSkladBlok(supabase, nazev);
      if (!result.ok) return { error: result.message };

      setBloky((prev) => {
        if (prev.some((row) => row.sklad_blok_id === result.value)) {
          return prev;
        }
        return [...prev, { sklad_blok_id: result.value, nazev: result.nazev }];
      });

      selection.setBlokId(result.value);
      selection.setKategorieId("");
      selection.setPodkategorieId("");
      await onAfterCreate?.();
      return {};
    },
    [onAfterCreate, selection]
  );

  const onQuickCreateKategorie: SkladConfigQuickCreateHandler = useCallback(
    async (nazev) => {
      if (!selection.blokId) return { error: "Nejdřív vyber okruh." };

      const result = await createInlineKategorie(
        supabase,
        nazev,
        selection.blokId
      );
      if (!result.ok) return { error: result.message };

      setKategorie((prev) => {
        if (prev.some((row) => row.kategorie_techniky_id === result.value)) {
          return prev;
        }
        return [
          ...prev,
          {
            kategorie_techniky_id: result.value,
            nazev: result.nazev,
            sklad_blok_id: selection.blokId,
          },
        ];
      });

      selection.setKategorieId(result.value);
      selection.setPodkategorieId("");
      await onAfterCreate?.();
      return {};
    },
    [onAfterCreate, selection]
  );

  const onQuickCreatePodkategorie: SkladConfigQuickCreateHandler = useCallback(
    async (nazev) => {
      if (!selection.kategorieId) return { error: "Nejdřív vyber kategorii." };

      const result = await createInlinePodkategorie(
        supabase,
        nazev,
        selection.kategorieId
      );
      if (!result.ok) return { error: result.message };

      setPodkategorie((prev) => {
        if (prev.some((row) => row.podkategorie_techniky_id === result.value)) {
          return prev;
        }
        return [
          ...prev,
          {
            podkategorie_techniky_id: result.value,
            nazev: result.nazev,
            kategorie_techniky_id: selection.kategorieId,
            kategorie_nazev: null,
          },
        ];
      });

      selection.setPodkategorieId(result.value);
      await onAfterCreate?.();
      return {};
    },
    [onAfterCreate, selection]
  );

  const onQuickCreateJednotka: SkladConfigQuickCreateHandler = useCallback(
    async (nazev) => {
      const result = await createInlineJednotka(supabase, nazev);
      if (!result.ok) return { error: result.message };

      const { data, error: fetchError } = await queryJednotkySkladuFull(supabase);
      if (!fetchError && data) {
        const created = (data as SkladJednotka[]).find(
          (row) => row.nazev === result.nazev
        );
        if (created) {
          setJednotky((prev) => {
            if (prev.some((row) => row.jednotka_id === created.jednotka_id)) {
              return prev;
            }
            return [...prev, created];
          });
        }
      }

      selection.setJednotka(result.value);
      await onAfterCreate?.();
      return {};
    },
    [onAfterCreate, selection]
  );

  return {
    bloky,
    kategorie,
    podkategorie,
    jednotky,
    onQuickCreateBlok,
    onQuickCreateKategorie,
    onQuickCreatePodkategorie,
    onQuickCreateJednotka,
  };
}
