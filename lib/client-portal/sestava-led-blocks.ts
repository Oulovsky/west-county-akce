import type { LedTypKod, LedWallBlock, SestavaKonfiguratorState } from "@/lib/client-portal/sestava-konfigurator-types";
import {
  MOBILNI_LED_MAX_SIRKA_M,
  MOBILNI_LED_MAX_VYSKA_M,
} from "@/lib/client-portal/sestava-konfigurator-types";

export const LED_BLOCK_LABELS = {
  podium: "LED wall na pódiu",
  branka_vlevo: "LED wall branka vlevo",
  branka_vpravo: "LED wall branka vpravo",
} as const;

export type LedBlockKey = keyof typeof LED_BLOCK_LABELS;

export const LED_BLOCK_KEYS: LedBlockKey[] = ["podium", "branka_vlevo", "branka_vpravo"];

export function emptyLedWallBlock(defaultTyp: LedTypKod = "p3_9_outdoor"): LedWallBlock {
  return { enabled: false, typ_kod: defaultTyp, sirka_m: null, vyska_m: null };
}

export function getLedBlock(state: SestavaKonfiguratorState, key: LedBlockKey): LedWallBlock {
  if (key === "podium") return state.led_podium;
  if (key === "branka_vlevo") return state.led_branka_vlevo;
  return state.led_branka_vpravo;
}

export function setLedBlock(
  state: SestavaKonfiguratorState,
  key: LedBlockKey,
  block: LedWallBlock
): SestavaKonfiguratorState {
  if (key === "podium") return { ...state, led_podium: block };
  if (key === "branka_vlevo") return { ...state, led_branka_vlevo: block };
  return { ...state, led_branka_vpravo: block };
}

export function anyLedWallBlockEnabled(state: SestavaKonfiguratorState): boolean {
  return (
    state.led_podium.enabled ||
    state.led_branka_vlevo.enabled ||
    state.led_branka_vpravo.enabled
  );
}

export function enabledLedWallBlocks(state: SestavaKonfiguratorState): { key: LedBlockKey; block: LedWallBlock }[] {
  return LED_BLOCK_KEYS.filter((key) => getLedBlock(state, key).enabled).map((key) => ({
    key,
    block: getLedBlock(state, key),
  }));
}

export function validateLedBlockDimensions(
  block: LedWallBlock,
  label: string,
  options?: { maxSirka?: number; maxVyska?: number }
): string[] {
  const errors: string[] = [];
  if (!block.enabled) return errors;
  if (!block.sirka_m || !block.vyska_m) {
    errors.push(`${label}: zadejte šířku i výšku LED wall.`);
    return errors;
  }
  if (options?.maxSirka != null && block.sirka_m > options.maxSirka + 0.001) {
    errors.push(
      `${label}: maximální šířka je ${options.maxSirka} m.`
    );
  }
  if (options?.maxVyska != null && block.vyska_m > options.maxVyska + 0.001) {
    errors.push(
      `${label}: maximální výška je ${options.maxVyska} m.`
    );
  }
  return errors;
}

export function mobilniLedLimits() {
  return { maxSirka: MOBILNI_LED_MAX_SIRKA_M, maxVyska: MOBILNI_LED_MAX_VYSKA_M };
}
