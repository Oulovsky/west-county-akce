import {
  computeLedPanelCountFromDimensions,
  findLedTyp,
} from "@/lib/client-portal/sestava-konfigurator-katalog";
import type {
  PortalSestavaKatalog,
  SestavaKonfiguratorState,
  SestavaNakladkaPolozka,
  SestavaNakladkaVypocet,
} from "@/lib/client-portal/sestava-konfigurator-types";
import {
  enabledLedWallBlocks,
  type LedBlockKey,
} from "@/lib/client-portal/sestava-led-blocks";

const LED_UMISTENI_LABEL: Record<LedBlockKey, string> = {
  podium: "podium",
  branka_vlevo: "branka_vlevo",
  branka_vpravo: "branka_vpravo",
};

function pushLedPanelPolozka(
  polozky: SestavaNakladkaPolozka[],
  input: {
    typKod: string;
    typNazev: string;
    sirkaM: number;
    vyskaM: number;
    panelSirkaM: number;
    panelVyskaM: number;
    skladPolozkaId: string | null;
    umisteni: LedBlockKey;
  }
) {
  const mnozstvi = computeLedPanelCountFromDimensions(
    input.sirkaM,
    input.vyskaM,
    input.panelSirkaM,
    input.panelVyskaM
  );
  if (mnozstvi <= 0) return;

  polozky.push({
    kod: "led_panel",
    nazev: `LED panel ${input.typNazev}`,
    mnozstvi,
    jednotka: "ks",
    sklad_polozka_id: input.skladPolozkaId,
    metadata: {
      led_typ_kod: input.typKod,
      umisteni: LED_UMISTENI_LABEL[input.umisteni],
      sirka_m: input.sirkaM,
      vyska_m: input.vyskaM,
      panel_sirka_m: input.panelSirkaM,
      panel_vyska_m: input.panelVyskaM,
    },
  });
}

/** Výpočtová nakládka z konfigurace sestavy — bez setupů podle rozměru. */
export function computeNakladkaFromSestava(
  katalog: PortalSestavaKatalog,
  state: SestavaKonfiguratorState
): SestavaNakladkaVypocet {
  const parametry = {
    podium_sirka_m: state.podium_sirka_m,
    podium_hloubka_m: state.podium_hloubka_m,
    podium_vyska_m: state.podium_vyska_m,
    kamery_pocet: state.kamery_pocet,
    dron: state.dron,
  };

  if (state.rezim === "atypicka") {
    return { polozky: [], parametry };
  }

  const polozky: SestavaNakladkaPolozka[] = [];

  // Pódium je katalogový setup — HW obsah se řeší v setup_polozky, ne výpočtem zde.

  for (const { key, block } of enabledLedWallBlocks(state)) {
    if (!block.typ_kod || !block.sirka_m || !block.vyska_m) continue;
    const typ = findLedTyp(katalog, block.typ_kod);
    if (!typ) continue;

    pushLedPanelPolozka(polozky, {
      typKod: typ.kod,
      typNazev: typ.nazev,
      sirkaM: block.sirka_m,
      vyskaM: block.vyska_m,
      panelSirkaM: typ.panel_sirka_m,
      panelVyskaM: typ.panel_vyska_m,
      skladPolozkaId: typ.sklad_polozka_id,
      umisteni: key,
    });
  }

  return { polozky, parametry };
}

export function sestavaNakladkaFromOdpovediExtra(
  extra: Record<string, unknown> | null | undefined
): SestavaNakladkaVypocet | null {
  const raw = extra?.sestava_nakladka_vypocet;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<SestavaNakladkaVypocet>;
  if (!Array.isArray(row.polozky)) return null;
  return {
    polozky: row.polozky as SestavaNakladkaPolozka[],
    parametry: (row.parametry ?? {
      podium_sirka_m: null,
      podium_hloubka_m: null,
      podium_vyska_m: null,
      kamery_pocet: 0,
      dron: false,
    }) as SestavaNakladkaVypocet["parametry"],
  };
}
