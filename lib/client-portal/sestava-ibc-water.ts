import type { SestavaKonfiguratorState } from "@/lib/client-portal/sestava-konfigurator-types";

export const IBC_TANK_LITERS = 1000;
export const ZASTRESENE_STAGE_IBC_COUNT = 4;
export const LED_BRANKA_WITH_STAGE_IBC_COUNT = 2;
export const LED_BRANKA_STANDALONE_IBC_COUNT = 3;

export type IbcWaterRequirement = {
  ibcCount: number;
  stageIbcCount: number;
  brankaIbcCount: number;
  brankaCount: number;
  liters: number;
  text: string;
  summaryLine: string;
};

function countEnabledLedBranky(sestava: SestavaKonfiguratorState): number {
  return (
    (sestava.led_branka_vlevo.enabled ? 1 : 0) + (sestava.led_branka_vpravo.enabled ? 1 : 0)
  );
}

function formatIbcWaterDetailText(input: {
  liters: number;
  stageIbcCount: number;
  brankaIbcCount: number;
  brankaCount: number;
  hasZastreseneStage: boolean;
}): string {
  const { liters, stageIbcCount, brankaIbcCount, brankaCount, hasZastreseneStage } = input;

  if (hasZastreseneStage && brankaCount === 0) {
    return `Klient musí zajistit vodu k naplnění zátěže: ${liters} l (${stageIbcCount}× IBC 1000 l).`;
  }

  if (hasZastreseneStage && brankaCount > 0) {
    return `Klient musí zajistit vodu k naplnění zátěže: ${liters} l (stage ${stageIbcCount}× IBC + LED branky ${brankaIbcCount}× IBC).`;
  }

  if (brankaCount === 1) {
    return `Klient musí zajistit vodu k naplnění zátěže: ${liters} l (samostatná LED branka ${brankaIbcCount}× IBC).`;
  }

  return `Klient musí zajistit vodu k naplnění zátěže: ${liters} l (samostatné LED branky ${brankaIbcCount}× IBC).`;
}

/** Požadavek na vodu pro IBC zátěže podle konfigurace sestavy (ne skladová položka). */
export function calculateIbcWaterRequirement(
  sestava: SestavaKonfiguratorState
): IbcWaterRequirement | null {
  if (sestava.rezim === "atypicka") return null;
  if (sestava.kotveni_typ !== "ibc_boxy") return null;

  const brankaCount = countEnabledLedBranky(sestava);
  const hasZastreseneStage = sestava.stage_typ === "zastresene";

  const stageIbcCount = hasZastreseneStage ? ZASTRESENE_STAGE_IBC_COUNT : 0;
  const brankaIbcPerUnit = hasZastreseneStage
    ? LED_BRANKA_WITH_STAGE_IBC_COUNT
    : LED_BRANKA_STANDALONE_IBC_COUNT;
  const brankaIbcCount = brankaCount * brankaIbcPerUnit;
  const ibcCount = stageIbcCount + brankaIbcCount;

  if (ibcCount <= 0) return null;

  const liters = ibcCount * IBC_TANK_LITERS;
  const text = formatIbcWaterDetailText({
    liters,
    stageIbcCount,
    brankaIbcCount,
    brankaCount,
    hasZastreseneStage,
  });

  return {
    ibcCount,
    stageIbcCount,
    brankaIbcCount,
    brankaCount,
    liters,
    text,
    summaryLine: `Zajištění vody pro IBC zátěže: ${liters} l`,
  };
}
