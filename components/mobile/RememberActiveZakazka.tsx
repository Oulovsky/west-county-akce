"use client";

import { useEffect } from "react";
import { rememberActiveZakazka } from "@/components/mobile/useActiveZakazkaId";

export function RememberActiveZakazka({
  zakazkaId,
  cislo,
  nazev,
}: {
  zakazkaId: string;
  cislo?: string | null;
  nazev?: string | null;
}) {
  useEffect(() => {
    rememberActiveZakazka(zakazkaId, { cislo, nazev });
  }, [zakazkaId, cislo, nazev]);

  return null;
}
