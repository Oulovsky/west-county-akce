import { applyDiscountFromTargetPrice } from "@/lib/pricing/discount";
import { deriveSetupSelectionsFromSestava } from "@/lib/client-portal/sestava-konfigurator-form";
import type { PortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-types";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";
import type {
  ObjednavkaExtraPolozka,
  ObjednavkaPricingBlock,
  ObjednavkaPricingPolozkaLine,
  ObjednavkaSetupPolozka,
  PoptavkaObjednavkaDraftData,
} from "@/lib/client-portal/poptavka-objednavka-types";
import type { SetupOblast } from "@/lib/client-portal/types";

export type SkladPolozkaPricingRow = {
  skladovaPolozkaId: string;
  nazev: string;
  fakturacniCena: number | null;
  okruhNazev: string | null;
  kategorieNazev: string | null;
  podkategorieNazev: string | null;
  pozice: string | null;
  celkemKDispozici: number | null;
};

export type SetupPolozkaPricingRow = {
  setupId: string;
  skladovaPolozkaId: string;
  mnozstvi: number;
};

export type ObjednavkaPricingCatalog = {
  skladPolozky: SkladPolozkaPricingRow[];
  setupPolozkyBySetupId: Record<string, SetupPolozkaPricingRow[]>;
  setupNazvy: Record<string, { nazev: string; oblast: SetupOblast }>;
};

function skladMap(catalog: ObjednavkaPricingCatalog): Map<string, SkladPolozkaPricingRow> {
  return new Map(catalog.skladPolozky.map((row) => [row.skladovaPolozkaId, row]));
}

export function deriveObjednavkaSetupyFromSestava(
  sestava: PoptavkaObjednavkaDraftData["sestava"],
  katalog: PortalSestavaKatalog,
  portalSetups: PortalSetupsByOblast
): ObjednavkaSetupPolozka[] {
  const selections = deriveSetupSelectionsFromSestava(sestava, katalog, portalSetups);
  const setupById = new Map<string, { nazev: string; oblast: SetupOblast }>();

  for (const [oblast, list] of Object.entries(portalSetups) as [SetupOblast, typeof portalSetups.stage][]) {
    for (const setup of list ?? []) {
      setupById.set(setup.setup_id, { nazev: setup.nazev, oblast });
    }
  }

  return selections.map((sel) => {
    const meta = setupById.get(sel.setup_id);
    return {
      setupId: sel.setup_id,
      nazev: meta?.nazev ?? sel.setup_id,
      oblast: meta?.oblast ?? "stage",
      mnozstvi: Math.max(1, Math.floor(sel.mnozstvi || 1)),
      poznamkaKlienta: sel.poznamka_klienta ?? null,
      poznamkaInterni: null,
    };
  });
}

type AggregatedQty = {
  mnozstvi: number;
  zdroj: "setup" | "extra";
  setupNazev?: string;
  /** Název pro breakdown (u konkrétního kusu label kusu). */
  displayNazev?: string;
  skladovyKusId?: string | null;
  typVyberu?: ObjednavkaExtraPolozka["typVyberu"];
};

function aggregateSkladQuantities(
  setupy: ObjednavkaSetupPolozka[],
  extraPolozky: ObjednavkaExtraPolozka[],
  pricingCatalog: ObjednavkaPricingCatalog
): Map<string, AggregatedQty[]> {
  const map = new Map<string, AggregatedQty[]>();

  const push = (skladId: string, entry: AggregatedQty) => {
    const rows = map.get(skladId) ?? [];
    rows.push(entry);
    map.set(skladId, rows);
  };

  for (const setup of setupy) {
    const polozky = pricingCatalog.setupPolozkyBySetupId[setup.setupId] ?? [];
    for (const row of polozky) {
      push(row.skladovaPolozkaId, {
        mnozstvi: row.mnozstvi * setup.mnozstvi,
        zdroj: "setup",
        setupNazev: setup.nazev,
      });
    }
  }

  for (const extra of extraPolozky) {
    if (!extra.skladovaPolozkaId) continue;

    if (extra.typVyberu === "kus") {
      if (!extra.skladovyKusId) continue;
      push(extra.skladovaPolozkaId, {
        mnozstvi: 1,
        zdroj: "extra",
        displayNazev: extra.nazev,
        skladovyKusId: extra.skladovyKusId,
        typVyberu: "kus",
      });
      continue;
    }

    if (extra.mnozstvi <= 0) continue;
    push(extra.skladovaPolozkaId, {
      mnozstvi: extra.mnozstvi,
      zdroj: "extra",
      displayNazev: extra.nazev,
      typVyberu: "polozka",
    });
  }

  return map;
}

export function computeObjednavkaPricingBreakdown(input: {
  setupy: ObjednavkaSetupPolozka[];
  extraPolozky: ObjednavkaExtraPolozka[];
  pricingCatalog: ObjednavkaPricingCatalog;
}): {
  polozky: ObjednavkaPricingPolozkaLine[];
  polozkyBezCeny: string[];
  setupCastka: number;
  extraCastka: number;
  vypoctovaCena: number;
} {
  const sklad = skladMap(input.pricingCatalog);
  const aggregated = aggregateSkladQuantities(
    input.setupy,
    input.extraPolozky,
    input.pricingCatalog
  );

  const polozky: ObjednavkaPricingPolozkaLine[] = [];
  const polozkyBezCeny: string[] = [];
  let setupCastka = 0;
  let extraCastka = 0;

  for (const [skladId, entries] of aggregated) {
    const meta = sklad.get(skladId);
    const catalogNazev = meta?.nazev ?? skladId;
    const cenaAkce = meta?.fakturacniCena ?? null;

    for (const entry of entries) {
      const nazev = entry.displayNazev ?? catalogNazev;
      const celkem = cenaAkce != null ? entry.mnozstvi * cenaAkce : 0;
      if (cenaAkce == null) {
        polozkyBezCeny.push(`${nazev} (${entry.mnozstvi}×)`);
      }
      if (entry.zdroj === "setup") {
        setupCastka += celkem;
      } else {
        extraCastka += celkem;
      }
      polozky.push({
        skladovaPolozkaId: skladId,
        skladovyKusId: entry.skladovyKusId ?? null,
        nazev,
        mnozstvi: entry.mnozstvi,
        cenaAkce,
        celkem,
        zdroj: entry.zdroj,
        setupNazev: entry.setupNazev,
        typVyberu: entry.typVyberu,
      });
    }
  }

  return {
    polozky,
    polozkyBezCeny: [...new Set(polozkyBezCeny)],
    setupCastka,
    extraCastka,
    vypoctovaCena: setupCastka + extraCastka,
  };
}

export function buildObjednavkaPricingBlock(input: {
  setupy: ObjednavkaSetupPolozka[];
  extraPolozky: ObjednavkaExtraPolozka[];
  pricingCatalog: ObjednavkaPricingCatalog;
  pozadovanaCena?: number | null;
  previous?: ObjednavkaPricingBlock | null;
  freezeBreakdown?: boolean;
}): ObjednavkaPricingBlock {
  const breakdown = computeObjednavkaPricingBreakdown({
    setupy: input.setupy,
    extraPolozky: input.extraPolozky,
    pricingCatalog: input.pricingCatalog,
  });

  const pozadovanaCena =
    input.pozadovanaCena ??
    input.previous?.pozadovanaCena ??
    input.previous?.konecnaCena ??
    null;

  let slevaProcent = input.previous?.slevaProcent ?? null;
  let konecnaCena = input.previous?.konecnaCena ?? null;

  if (pozadovanaCena != null && breakdown.vypoctovaCena > 0) {
    const applied = applyDiscountFromTargetPrice(breakdown.vypoctovaCena, pozadovanaCena);
    if (applied.ok) {
      slevaProcent = applied.slevaProcent;
      konecnaCena = applied.konecnaCena;
    }
  } else if (breakdown.vypoctovaCena <= 0) {
    slevaProcent = null;
    konecnaCena = null;
  }

  return {
    vypoctovaCena: breakdown.vypoctovaCena,
    pozadovanaCena,
    slevaProcent,
    konecnaCena,
    setupCastka: breakdown.setupCastka,
    extraCastka: breakdown.extraCastka,
    polozky: input.freezeBreakdown ? breakdown.polozky : undefined,
    polozkyBezCeny: breakdown.polozkyBezCeny,
  };
}

export function finalizeObjednavkaDraftPricing(
  draft: PoptavkaObjednavkaDraftData,
  options: {
    pricingCatalog: ObjednavkaPricingCatalog;
    katalog: PortalSestavaKatalog;
    portalSetups: PortalSetupsByOblast;
    freezeBreakdown?: boolean;
  }
): PoptavkaObjednavkaDraftData {
  const setupy = deriveObjednavkaSetupyFromSestava(
    draft.sestava,
    options.katalog,
    options.portalSetups
  );

  draft.technickePlneni = {
    ...draft.technickePlneni,
    setupy,
    extraPolozky: draft.technickePlneni.extraPolozky ?? [],
  };

  draft.pricing = buildObjednavkaPricingBlock({
    setupy,
    extraPolozky: draft.technickePlneni.extraPolozky,
    pricingCatalog: options.pricingCatalog,
    pozadovanaCena: draft.pricing?.pozadovanaCena ?? null,
    previous: draft.pricing,
    freezeBreakdown: options.freezeBreakdown,
  });

  return draft;
}

export function formatSkladPolozkaPricingLabel(row: SkladPolozkaPricingRow): string {
  const price =
    row.fakturacniCena != null
      ? ` — ${Math.round(row.fakturacniCena).toLocaleString("cs-CZ")} Kč / akce`
      : "";
  const meta = [row.kategorieNazev, row.okruhNazev].filter(Boolean).join(" · ");
  return meta ? `${row.nazev} (${meta})${price}` : `${row.nazev}${price}`;
}
