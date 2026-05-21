"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { readActiveZakazka, saveActiveZakazka } from "@/lib/mobile/active-zakazka";
import { getWorkflowZakazkaId, isZakazkaId } from "@/lib/mobile/routes";

export function useActiveZakazkaId() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryZakazka = searchParams.get("zakazka");
  const contextualId = getWorkflowZakazkaId(pathname, queryZakazka);
  const [storedId, setStoredId] = useState<string | null>(null);

  useEffect(() => {
    if (contextualId) {
      const existing = readActiveZakazka();
      saveActiveZakazka({
        zakazkaId: contextualId,
        cislo: existing?.zakazkaId === contextualId ? existing.cislo : existing?.cislo,
        nazev: existing?.zakazkaId === contextualId ? existing.nazev : existing?.nazev,
      });
      setStoredId(contextualId);
      return;
    }

    setStoredId(readActiveZakazka()?.zakazkaId ?? null);
  }, [contextualId, pathname, queryZakazka]);

  return contextualId ?? storedId;
}

export function rememberActiveZakazka(
  zakazkaId: string,
  meta?: { cislo?: string | null; nazev?: string | null }
) {
  if (!isZakazkaId(zakazkaId)) return;
  saveActiveZakazka({
    zakazkaId,
    cislo: meta?.cislo ?? null,
    nazev: meta?.nazev ?? null,
  });
}
