import {
  computePodiumModuly,
  estimatePodiumLegs,
  findPraktikablVariant,
  findZastreseniVariant,
  getAvailableKotveniTypy,
  getMaxCistaVyska,
  getZastreseniHeightOptions,
  isIntegerMeter,
} from "@/lib/client-portal/sestava-konfigurator-katalog";
import type {
  KotveniPovrch,
  KotveniTyp,
  LedObsluhaObsahu,
  LedTypKod,
  LedUmisteni,
  LedWallBlock,
  MobilniSchodyStrana,
  PortalSestavaKatalog,
  PraktikablTyp,
  PraktikablUmisteni,
  PresetVelikost,
  SchodyStrana,
  SchodyVolba,
  SestavaKonfiguratorState,
  SestavaKonfiguratorValidation,
  SestavaOdhadModulu,
  StageTyp,
  ZastreseniCistaVyskaM,
} from "@/lib/client-portal/sestava-konfigurator-types";
import { ZASTRESENI_CISTA_VYSKA_OPTIONS } from "@/lib/client-portal/sestava-konfigurator-types";
import {
  anyLedWallBlockEnabled,
  emptyLedWallBlock,
  enabledLedWallBlocks,
  getLedBlock,
  LED_BLOCK_KEYS,
  LED_BLOCK_LABELS,
  mobilniLedLimits,
  setLedBlock,
  validateLedBlockDimensions,
} from "@/lib/client-portal/sestava-led-blocks";
import type { PoptavkaSetupInput } from "@/lib/client-portal/poptavka-form";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";

export const EMPTY_SESTAVA_KONFIGURATOR: SestavaKonfiguratorState = {
  rezim: "standard",
  atypicka_poptavka_text: "",
  stage_typ: null,
  zastreseni_variant_id: null,
  zastreseni_setup_id: null,
  zastreseni_sirka_m: null,
  zastreseni_hloubka_m: null,
  mobilni_setup_id: null,
  cista_vyska_m: null,
  podium_sirka_m: null,
  podium_hloubka_m: null,
  podium_vyska_m: null,
  schody_pocet: 0,
  schody_strany: [],
  praktikabl_typ: "zadny",
  praktikabl_variant_id: null,
  praktikabl_vyska_m: null,
  praktikabl_umisteni: null,
  praktikabl_schudky: false,
  praktikabl_mobilni: false,
  praktikabl_poznamka: "",
  kotveni_typ: null,
  kotveni_povrch: null,
  led_pozadovano: false,
  led_typ_kod: null,
  led_sirka_m: null,
  led_vyska_m: null,
  led_umisteni: null,
  led_rohy: false,
  led_obsluha_obsahu: null,
  led_podium: emptyLedWallBlock(),
  led_branka_vlevo: emptyLedWallBlock(),
  led_branka_vpravo: emptyLedWallBlock(),
  mobilni_schody_strana: null,
  mobilni_pozaduje_zvuk: false,
  mobilni_pozaduje_svetla: false,
  zvuk_preset: null,
  zvuk_setup_id: null,
  svetla_preset: null,
  svetla_setup_id: null,
  kamery_pocet: 0,
  dron: false,
  poznamka: "",
};

const STAGE_TYP_VALUES: StageTyp[] = ["mobilni", "zastresene"];
const SCHODY_STRANY: SchodyStrana[] = ["vlevo", "vpravo"];
const KOTVENI: KotveniTyp[] = ["zatloukane", "ibc_boxy"];
const KOTVENI_POVRCH: KotveniPovrch[] = ["trava_hlina", "asfalt_beton"];
const PRACTIKABL: PraktikablTyp[] = ["zadny", "bicí", "jiny"];
const PRACTIKABL_UM: PraktikablUmisteni[] = [
  "stred_vzadu",
  "vlevo_vzadu",
  "vpravo_vzadu",
  "vlastni",
];
const LED_KOD: LedTypKod[] = [
  "p2_indoor",
  "p2_6_outdoor",
  "p3_9_outdoor",
  "p4_8_outdoor",
  "p6_4_mantel",
];
const LED_UM: LedUmisteni[] = ["stack_na_podiu", "mimo_stage_branka", "mantinel"];
const LED_OBSLUHA: LedObsluhaObsahu[] = ["klient_sam", "nase_obsahu"];
const PRESET: PresetVelikost[] = ["mala", "stredni", "velka"];

function parseNumber(value: unknown): number | null {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const text = String(value ?? "").trim() as T;
  return allowed.includes(text) ? text : null;
}

function parseBool(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

function parseSchodyStrany(value: unknown): SchodyStrana[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is SchodyStrana => SCHODY_STRANY.includes(v as SchodyStrana));
  }
  const text = String(value ?? "");
  if (!text) return [];
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is SchodyStrana => SCHODY_STRANY.includes(part as SchodyStrana));
}

function parseKotveniPovrch(value: unknown): KotveniPovrch | null {
  const parsed = parseEnum(value, KOTVENI_POVRCH);
  if (parsed) return parsed;
  const text = String(value ?? "").trim().toLowerCase();
  if (text.includes("tráv") || text.includes("trav") || text.includes("hlín") || text.includes("hlin")) {
    return "trava_hlina";
  }
  if (text.includes("asfalt") || text.includes("beton")) {
    return "asfalt_beton";
  }
  return null;
}

function parseLedWallBlock(value: unknown, fallback: LedWallBlock): LedWallBlock {
  if (!value || typeof value !== "object") return { ...fallback };
  const data = value as Partial<LedWallBlock>;
  return {
    enabled: parseBool(data.enabled),
    typ_kod: parseEnum(data.typ_kod, LED_KOD) ?? fallback.typ_kod,
    sirka_m: parseNumber(data.sirka_m),
    vyska_m: parseNumber(data.vyska_m),
  };
}

function parseMobilniSchodyStrana(value: unknown): MobilniSchodyStrana | null {
  return parseEnum(value, ["vlevo", "vpravo"] as const);
}

function legacyLedBlockFromState(data: Partial<SestavaKonfiguratorState>): LedWallBlock | null {
  if (!data.led_pozadovano || !data.led_sirka_m || !data.led_vyska_m) return null;
  return {
    enabled: true,
    typ_kod: data.led_typ_kod ?? "p3_9_outdoor",
    sirka_m: data.led_sirka_m,
    vyska_m: data.led_vyska_m,
  };
}

function hasNewLedBlocks(data: Partial<SestavaKonfiguratorState>): boolean {
  return Boolean(data.led_podium || data.led_branka_vlevo || data.led_branka_vpravo);
}

export function migrateLegacySestavaState(
  data: Partial<SestavaKonfiguratorState>
): SestavaKonfiguratorState {
  const base: SestavaKonfiguratorState = {
    ...EMPTY_SESTAVA_KONFIGURATOR,
    ...data,
    rezim: data.rezim === "atypicka" ? "atypicka" : "standard",
    atypicka_poptavka_text: String(data.atypicka_poptavka_text ?? "").trim(),
    schody_strany: parseSchodyStrany(data.schody_strany),
    schody_pocet: Math.max(0, Math.min(2, Number(data.schody_pocet ?? 0) || 0)),
    kamery_pocet: Math.max(0, Math.min(3, Number(data.kamery_pocet ?? 0) || 0)),
    kotveni_povrch: parseKotveniPovrch(data.kotveni_povrch),
    praktikabl_mobilni: parseBool(data.praktikabl_mobilni),
    led_podium: parseLedWallBlock(data.led_podium, emptyLedWallBlock()),
    led_branka_vlevo: parseLedWallBlock(data.led_branka_vlevo, emptyLedWallBlock()),
    led_branka_vpravo: parseLedWallBlock(data.led_branka_vpravo, emptyLedWallBlock()),
    mobilni_schody_strana: parseMobilniSchodyStrana(data.mobilni_schody_strana),
    mobilni_pozaduje_zvuk: parseBool(data.mobilni_pozaduje_zvuk),
    mobilni_pozaduje_svetla: parseBool(data.mobilni_pozaduje_svetla),
  };

  if (!hasNewLedBlocks(data)) {
    const legacy = legacyLedBlockFromState(data);
    if (legacy) {
      if (data.led_umisteni === "stack_na_podiu" || data.led_umisteni === "mantinel") {
        base.led_podium = legacy;
      } else if (data.led_umisteni === "mimo_stage_branka") {
        base.led_branka_vlevo = legacy;
      } else {
        base.led_podium = legacy;
      }
    }
  }

  if (base.stage_typ === "mobilni") {
    if (!data.mobilni_schody_strana) {
      if (base.schody_strany.includes("vlevo")) base.mobilni_schody_strana = "vlevo";
      else if (base.schody_strany.includes("vpravo")) base.mobilni_schody_strana = "vpravo";
    }
    if (data.mobilni_pozaduje_zvuk == null) {
      base.mobilni_pozaduje_zvuk = Boolean(data.zvuk_preset || data.zvuk_setup_id);
    }
    if (data.mobilni_pozaduje_svetla == null) {
      base.mobilni_pozaduje_svetla = Boolean(data.svetla_preset || data.svetla_setup_id);
    }
  }

  return normalizeSestavaStateForSave(base);
}

export function normalizeSestavaStateForSave(
  state: SestavaKonfiguratorState
): SestavaKonfiguratorState {
  const anyLed = anyLedWallBlockEnabled(state);
  const first = enabledLedWallBlocks(state)[0];
  let led_umisteni: LedUmisteni | null = null;
  if (state.led_podium.enabled) {
    led_umisteni = state.led_podium.typ_kod === "p6_4_mantel" ? "mantinel" : "stack_na_podiu";
  } else if (state.led_branka_vlevo.enabled || state.led_branka_vpravo.enabled) {
    led_umisteni = "mimo_stage_branka";
  }

  return {
    ...state,
    led_pozadovano: anyLed,
    led_typ_kod: first?.block.typ_kod ?? null,
    led_sirka_m: first?.block.sirka_m ?? null,
    led_vyska_m: first?.block.vyska_m ?? null,
    led_umisteni,
  };
}

export function schodyVolbaFromState(state: SestavaKonfiguratorState): SchodyVolba {
  if (state.schody_pocet <= 0 || state.schody_strany.length === 0) return "zadne";
  if (state.schody_pocet >= 2 && state.schody_strany.includes("vlevo") && state.schody_strany.includes("vpravo")) {
    return "vlevo_vpravo";
  }
  if (state.schody_strany.includes("vlevo")) return "vlevo";
  if (state.schody_strany.includes("vpravo")) return "vpravo";
  return "zadne";
}

export function applySchodyVolba(volba: SchodyVolba): Pick<SestavaKonfiguratorState, "schody_pocet" | "schody_strany"> {
  switch (volba) {
    case "zadne":
      return { schody_pocet: 0, schody_strany: [] };
    case "vlevo":
      return { schody_pocet: 1, schody_strany: ["vlevo"] };
    case "vpravo":
      return { schody_pocet: 1, schody_strany: ["vpravo"] };
    case "vlevo_vpravo":
      return { schody_pocet: 2, schody_strany: ["vlevo", "vpravo"] };
  }
}

export function sestavaFromOdpovediExtra(
  extra: Record<string, unknown> | null | undefined
): SestavaKonfiguratorState {
  const raw = extra?.sestava_konfigurator;
  if (!raw || typeof raw !== "object") return { ...EMPTY_SESTAVA_KONFIGURATOR };
  return migrateLegacySestavaState(raw as Partial<SestavaKonfiguratorState>);
}

export function parseSestavaKonfiguratorJson(
  jsonText: string | null | undefined
): SestavaKonfiguratorState {
  if (!jsonText?.trim()) return { ...EMPTY_SESTAVA_KONFIGURATOR };
  try {
    const parsed = JSON.parse(jsonText) as Partial<SestavaKonfiguratorState>;
    return sestavaFromOdpovediExtra({ sestava_konfigurator: parsed });
  } catch {
    return { ...EMPTY_SESTAVA_KONFIGURATOR };
  }
}

export function parseSestavaFormData(formData: FormData): SestavaKonfiguratorState {
  const json = formData.get("sestava_konfigurator_json");
  if (typeof json === "string" && json.trim()) {
    return parseSestavaKonfiguratorJson(json);
  }

  return normalizeSestavaStateForSave({
    rezim: parseEnum(formData.get("sestava_rezim"), ["standard", "atypicka"] as const) ?? "standard",
    atypicka_poptavka_text: String(formData.get("sestava_atypicka_text") ?? "").trim(),
    stage_typ: parseEnum(formData.get("sestava_stage_typ"), STAGE_TYP_VALUES),
    zastreseni_variant_id: String(formData.get("sestava_zastreseni_variant") ?? "").trim() || null,
    zastreseni_setup_id: String(formData.get("sestava_zastreseni_setup_id") ?? "").trim() || null,
    zastreseni_sirka_m: parseNumber(formData.get("sestava_zastreseni_sirka_m")),
    zastreseni_hloubka_m: parseNumber(formData.get("sestava_zastreseni_hloubka_m")),
    mobilni_setup_id: String(formData.get("sestava_mobilni_setup_id") ?? "").trim() || null,
    cista_vyska_m: parseNumber(formData.get("sestava_cista_vyska_m")),
    podium_sirka_m: parseNumber(formData.get("sestava_podium_sirka_m")),
    podium_hloubka_m: parseNumber(formData.get("sestava_podium_hloubka_m")),
    podium_vyska_m: parseNumber(formData.get("sestava_podium_vyska_m")),
    schody_pocet: Math.max(0, Math.min(2, parseNumber(formData.get("sestava_schody_pocet")) ?? 0)),
    schody_strany: parseSchodyStrany(formData.get("sestava_schody_strany")),
    praktikabl_typ: parseEnum(formData.get("sestava_praktikabl_typ"), PRACTIKABL) ?? "zadny",
    praktikabl_variant_id:
      String(formData.get("sestava_praktikabl_variant") ?? "").trim() || null,
    praktikabl_vyska_m: parseNumber(formData.get("sestava_praktikabl_vyska_m")),
    praktikabl_umisteni: parseEnum(formData.get("sestava_praktikabl_umisteni"), PRACTIKABL_UM),
    praktikabl_schudky: parseBool(formData.get("sestava_praktikabl_schudky")),
    praktikabl_mobilni: parseBool(formData.get("sestava_praktikabl_mobilni")),
    praktikabl_poznamka: String(formData.get("sestava_praktikabl_poznamka") ?? "").trim(),
    kotveni_typ: parseEnum(formData.get("sestava_kotveni_typ"), KOTVENI),
    kotveni_povrch: parseKotveniPovrch(formData.get("sestava_kotveni_povrch")),
    led_pozadovano: parseBool(formData.get("sestava_led_pozadovano")),
    led_typ_kod: parseEnum(formData.get("sestava_led_typ_kod"), LED_KOD),
    led_sirka_m: parseNumber(formData.get("sestava_led_sirka_m")),
    led_vyska_m: parseNumber(formData.get("sestava_led_vyska_m")),
    led_umisteni: parseEnum(formData.get("sestava_led_umisteni"), LED_UM),
    led_rohy: parseBool(formData.get("sestava_led_rohy")),
    led_obsluha_obsahu: parseEnum(formData.get("sestava_led_obsluha"), LED_OBSLUHA),
    led_podium: parseLedWallBlock(
      tryParseJson(formData.get("sestava_led_podium")),
      emptyLedWallBlock()
    ),
    led_branka_vlevo: parseLedWallBlock(
      tryParseJson(formData.get("sestava_led_branka_vlevo")),
      emptyLedWallBlock()
    ),
    led_branka_vpravo: parseLedWallBlock(
      tryParseJson(formData.get("sestava_led_branka_vpravo")),
      emptyLedWallBlock()
    ),
    mobilni_schody_strana: parseMobilniSchodyStrana(formData.get("sestava_mobilni_schody_strana")),
    mobilni_pozaduje_zvuk: parseBool(formData.get("sestava_mobilni_pozaduje_zvuk")),
    mobilni_pozaduje_svetla: parseBool(formData.get("sestava_mobilni_pozaduje_svetla")),
    zvuk_preset: parseEnum(formData.get("sestava_zvuk_preset"), PRESET),
    zvuk_setup_id: String(formData.get("sestava_zvuk_setup_id") ?? "").trim() || null,
    svetla_preset: parseEnum(formData.get("sestava_svetla_preset"), PRESET),
    svetla_setup_id: String(formData.get("sestava_svetla_setup_id") ?? "").trim() || null,
    kamery_pocet: Math.max(
      0,
      Math.min(3, parseNumber(formData.get("sestava_kamery_pocet")) ?? 0)
    ),
    dron: parseBool(formData.get("sestava_dron")),
    poznamka: String(formData.get("sestava_poznamka") ?? "").trim(),
  });
}

function tryParseJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function buildSestavaOdpovediExtra(state: SestavaKonfiguratorState) {
  return { sestava_konfigurator: normalizeSestavaStateForSave(state) };
}

export function computeOdhadModulu(
  katalog: PortalSestavaKatalog,
  state: SestavaKonfiguratorState
): SestavaOdhadModulu {
  const modulu = computePodiumModuly(katalog, state.podium_sirka_m, state.podium_hloubka_m);
  return {
    podium_modulu: modulu,
    odhad_noh: estimatePodiumLegs(modulu),
    odhad_schodu: state.schody_pocet,
  };
}

export function validateSestavaKonfigurator(
  state: SestavaKonfiguratorState,
  katalog: PortalSestavaKatalog
): SestavaKonfiguratorValidation {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (state.rezim === "atypicka") {
    if (!state.atypicka_poptavka_text.trim()) {
      errors.push("U atypické poptávky popište požadovanou techniku.");
    }
    return { warnings, errors };
  }

  if (!state.stage_typ) {
    errors.push("Vyberte typ stage / zastřešení.");
    return { warnings, errors };
  }

  const isMobilni = state.stage_typ === "mobilni";
  const maxVyska = getMaxCistaVyska(
    katalog,
    state.stage_typ,
    state.zastreseni_variant_id
  );
  const heightOptions = getZastreseniHeightOptions(maxVyska);
  const ledLimits = isMobilni ? mobilniLedLimits() : undefined;

  if (state.stage_typ === "zastresene") {
    const hasCatalogVariant = Boolean(state.zastreseni_variant_id);
    const hasSetupVariant = Boolean(state.zastreseni_setup_id);
    if (!hasCatalogVariant && !hasSetupVariant) {
      errors.push("Vyberte variantu zastřešení.");
    }
    const variant = findZastreseniVariant(katalog, state.zastreseni_variant_id);
    if (variant && state.zastreseni_sirka_m && state.zastreseni_hloubka_m) {
      const okSize =
        state.zastreseni_sirka_m === variant.sirka_m &&
        state.zastreseni_hloubka_m === variant.hloubka_m;
      if (!okSize) {
        errors.push("Vybraný rozměr zastřešení není v povoleném seznamu variant.");
      }
    }

    if (state.cista_vyska_m == null) {
      errors.push("Vyberte čistou výšku zastřešení.");
    } else if (
      !ZASTRESENI_CISTA_VYSKA_OPTIONS.includes(state.cista_vyska_m as ZastreseniCistaVyskaM)
    ) {
      errors.push("Výška zastřešení musí být 5, 6 nebo 7 m.");
    } else if (!heightOptions.includes(state.cista_vyska_m)) {
      errors.push(
        `Požadovaná čistá výška ${state.cista_vyska_m} m překračuje maximum pro zvolené zastřešení.`
      );
    }

    if (state.podium_sirka_m != null && !isIntegerMeter(state.podium_sirka_m)) {
      errors.push("Šířka pódia musí být celé číslo v metrech.");
    }
    if (state.podium_hloubka_m != null && !isIntegerMeter(state.podium_hloubka_m)) {
      errors.push("Hloubka pódia musí být celé číslo v metrech.");
    }

    const roofW = state.zastreseni_sirka_m;
    const roofD = state.zastreseni_hloubka_m;
    if (state.podium_sirka_m && roofW && state.podium_sirka_m > roofW) {
      warnings.push("Pódium je širší než zastřešení — zkontrolujte rozměry.");
    }
    if (state.podium_hloubka_m && roofD && state.podium_hloubka_m > roofD) {
      warnings.push("Pódium je hlubší než zastřešení — zkontrolujte rozměry.");
    }

    const schodyVolba = schodyVolbaFromState(state);
    if (state.schody_pocet === 1 && schodyVolba !== "vlevo" && schodyVolba !== "vpravo") {
      errors.push("U jednoho schodiště zvolte stranu vlevo nebo vpravo.");
    }
    if (state.schody_pocet === 2 && schodyVolba !== "vlevo_vpravo") {
      errors.push("U dvou schodišť musí být zvoleno vlevo i vpravo.");
    }
  }

  if (isMobilni) {
    if (!state.mobilni_schody_strana) {
      errors.push("U mobilní stage zvolte schody zleva nebo zprava.");
    }
    if (state.schody_pocet > 1 || schodyVolbaFromState(state) === "vlevo_vpravo") {
      errors.push("U mobilní stage lze zvolit pouze schody z jedné strany.");
    }
  }

  if (state.praktikabl_typ !== "zadny" && !state.praktikabl_umisteni) {
    errors.push("U praktikáblu zvolte umístění.");
  }

  if (!state.kotveni_povrch) {
    errors.push("Vyberte povrch pro kotvení / zátěž.");
  } else if (!state.kotveni_typ) {
    errors.push("Vyberte způsob kotvení nebo zátěže.");
  } else {
    const allowed = getAvailableKotveniTypy(state.kotveni_povrch);
    if (!allowed.includes(state.kotveni_typ)) {
      errors.push("Zvolený způsob kotvení není pro tento povrch dostupný.");
    }
  }

  if (state.kotveni_typ === "ibc_boxy") {
    warnings.push("Pořadatel musí zajistit vodu pro naplnění zátěže.");
  }

  const anyLed = anyLedWallBlockEnabled(state);
  for (const key of LED_BLOCK_KEYS) {
    const block = getLedBlock(state, key);
    errors.push(
      ...validateLedBlockDimensions(block, LED_BLOCK_LABELS[key], ledLimits)
    );
  }

  if (anyLed && !state.led_obsluha_obsahu) {
    errors.push("U LED wall zvolte způsob obsluhy obsahu.");
  }

  return { warnings, errors };
}

export function deriveSetupSelectionsFromSestava(
  state: SestavaKonfiguratorState,
  katalog: PortalSestavaKatalog,
  portalSetups: PortalSetupsByOblast
): PoptavkaSetupInput[] {
  if (state.rezim === "atypicka") {
    return [];
  }

  const selections: PoptavkaSetupInput[] = [];
  const seen = new Set<string>();

  const pushSetup = (setupId: string | null | undefined, qty = 1) => {
    if (!setupId || seen.has(setupId)) return;
    seen.add(setupId);
    selections.push({ setup_id: setupId, mnozstvi: qty, poznamka_klienta: null });
  };

  const findByOblastNazev = (oblast: keyof PortalSetupsByOblast, needle: string) => {
    const list = portalSetups[oblast] ?? [];
    const lower = needle.toLowerCase();
    return list.find((row) => row.nazev.toLowerCase().includes(lower))?.setup_id ?? null;
  };

  if (state.stage_typ === "mobilni") {
    pushSetup(state.mobilni_setup_id ?? katalog.mobilni_stage.setup_id);
    if (!state.mobilni_setup_id && !katalog.mobilni_stage.setup_id) {
      pushSetup(findByOblastNazev("stage", "mobil"));
    }
  } else if (state.stage_typ === "zastresene") {
    pushSetup(state.zastreseni_setup_id);
    if (!state.zastreseni_setup_id) {
      const variant = findZastreseniVariant(katalog, state.zastreseni_variant_id);
      pushSetup(variant?.setup_id ?? findByOblastNazev("stage", variant?.id ?? "zastřeš"));
    }
  }

  if (state.podium_sirka_m && state.podium_hloubka_m) {
    pushSetup(findByOblastNazev("stage", "pódium") ?? findByOblastNazev("stage", "podium"));
  }

  if (state.praktikabl_typ !== "zadny") {
    pushSetup(findByOblastNazev("stage", "praktikábl") ?? findByOblastNazev("stage", "riser"));
  }

  for (const { block } of enabledLedWallBlocks(state)) {
    if (block.typ_kod) {
      const preset = katalog.led_typy.find((row) => row.kod === block.typ_kod);
      pushSetup(findByOblastNazev("led_wall", preset?.pixel_pitch ?? "led"));
    }
  }

  if (state.stage_typ === "mobilni") {
    if (state.mobilni_pozaduje_zvuk) {
      pushSetup(findByOblastNazev("sound", "mobil"));
    }
    if (state.mobilni_pozaduje_svetla) {
      pushSetup(findByOblastNazev("lights", "mobil"));
    }
  } else {
    if (state.zvuk_setup_id) {
      pushSetup(state.zvuk_setup_id);
    } else if (state.zvuk_preset) {
      const preset = katalog.zvuk_presety.find((row) => row.kod === state.zvuk_preset);
      pushSetup(preset?.setup_id ?? findByOblastNazev("sound", state.zvuk_preset));
    }

    if (state.svetla_setup_id) {
      pushSetup(state.svetla_setup_id);
    } else if (state.svetla_preset) {
      const preset = katalog.svetla_presety.find((row) => row.kod === state.svetla_preset);
      pushSetup(preset?.setup_id ?? findByOblastNazev("lights", state.svetla_preset));
    }
  }

  if (state.kamery_pocet > 0) {
    pushSetup(findByOblastNazev("video", "kamer"));
  }
  if (state.dron) {
    pushSetup(findByOblastNazev("dron", "dron"));
  }

  return selections;
}

export function mergeSetupSelections(
  manual: PoptavkaSetupInput[],
  derived: PoptavkaSetupInput[]
): PoptavkaSetupInput[] {
  const map = new Map<string, PoptavkaSetupInput>();
  for (const row of derived) {
    map.set(row.setup_id, row);
  }
  for (const row of manual) {
    map.set(row.setup_id, row);
  }
  return Array.from(map.values());
}

const STAGE_LABELS: Record<StageTyp, string> = {
  mobilni: "Mobilní stage",
  zastresene: "Zastřešené pódium",
};

const KOTVENI_LABELS: Record<KotveniTyp, string> = {
  zatloukane: "Zatloukané kotvení",
  ibc_boxy: "Zátěž IBC boxy",
};

const KOTVENI_POVRCH_LABELS: Record<KotveniPovrch, string> = {
  trava_hlina: "Tráva / hlína",
  asfalt_beton: "Asfalt / beton",
};

const LED_UM_LABELS: Record<LedUmisteni, string> = {
  stack_na_podiu: "Stack na pódiu",
  mimo_stage_branka: "Mimo stage na brance",
  mantinel: "Mantinel P6,4",
};

const LED_OBSLUHA_LABELS: Record<LedObsluhaObsahu, string> = {
  klient_sam: "Obsah obsluhuje klient (technické zajištění námi)",
  nase_obsahu: "Naše obsluha LED obsahu po celou akci",
};

const SCHODY_VOLBA_LABELS: Record<SchodyVolba, string> = {
  zadne: "Bez schodiště",
  vlevo: "1× vlevo",
  vpravo: "1× vpravo",
  vlevo_vpravo: "2× vlevo i vpravo",
};

const MOBILNI_SCHODY_LABELS: Record<MobilniSchodyStrana, string> = {
  vlevo: "Schody zleva",
  vpravo: "Schody zprava",
};

function formatLedBlockLine(label: string, block: LedWallBlock): string {
  if (!block.enabled) return `${label}: ne`;
  const size =
    block.sirka_m && block.vyska_m ? `${block.sirka_m} × ${block.vyska_m} m` : "—";
  return `${label}: ano (${size})`;
}

export function buildSestavaSummaryLines(
  state: SestavaKonfiguratorState,
  katalog: PortalSestavaKatalog
): string[] {
  const lines: string[] = [];
  const migrated = migrateLegacySestavaState(state);

  if (migrated.rezim === "atypicka") {
    lines.push("Atypická technická poptávka — ruční návrh a nacenění");
    if (migrated.atypicka_poptavka_text.trim()) {
      lines.push(migrated.atypicka_poptavka_text.trim());
    }
    if (migrated.poznamka) lines.push(`Poznámka: ${migrated.poznamka}`);
    return lines;
  }

  if (!migrated.stage_typ) return lines;

  lines.push(`Stage: ${STAGE_LABELS[migrated.stage_typ]}`);
  if (migrated.stage_typ === "zastresene") {
    const v = findZastreseniVariant(katalog, migrated.zastreseni_variant_id);
    if (v) lines.push(`Zastřešení: ${v.nazev}`);
    if (migrated.zastreseni_sirka_m && migrated.zastreseni_hloubka_m) {
      lines.push(
        `Rozměr zastřešení: ${migrated.zastreseni_sirka_m} × ${migrated.zastreseni_hloubka_m} m`
      );
    }
    if (migrated.cista_vyska_m) {
      lines.push(`Čistá výška nad pódiem: ${migrated.cista_vyska_m} m`);
    }
    if (migrated.podium_sirka_m && migrated.podium_hloubka_m) {
      lines.push(
        `Pódium: ${migrated.podium_sirka_m} × ${migrated.podium_hloubka_m} m, výška ${migrated.podium_vyska_m ?? "—"} m`
      );
      const odhad = computeOdhadModulu(katalog, migrated);
      if (odhad.podium_modulu > 0) {
        lines.push(
          `Odhad podlahy: ${odhad.podium_modulu} modulů, cca ${odhad.odhad_noh} nohou, ${odhad.odhad_schodu} schodiště`
        );
      }
    }
    const schodyVolba = schodyVolbaFromState(migrated);
    if (schodyVolba !== "zadne") {
      lines.push(`Schody: ${SCHODY_VOLBA_LABELS[schodyVolba]}`);
    }
  }

  if (migrated.stage_typ === "mobilni") {
    if (migrated.mobilni_schody_strana) {
      lines.push(`Schody: ${MOBILNI_SCHODY_LABELS[migrated.mobilni_schody_strana]}`);
    }
    lines.push(`Ozvučení požadováno: ${migrated.mobilni_pozaduje_zvuk ? "ano" : "ne"}`);
    lines.push(`Osvětlení požadováno: ${migrated.mobilni_pozaduje_svetla ? "ano" : "ne"}`);
  }

  if (migrated.praktikabl_typ !== "zadny") {
    const pv = findPraktikablVariant(katalog, migrated.praktikabl_variant_id);
    lines.push(
      `Praktikábl: ${migrated.praktikabl_typ}${pv ? ` ${pv.nazev}` : ""}, umístění ${migrated.praktikabl_umisteni ?? "—"}`
    );
    if (migrated.praktikabl_mobilni) {
      lines.push("Mobilní praktikábl pro rychlou výměnu kapel");
    }
  }
  if (migrated.kotveni_typ && migrated.kotveni_povrch) {
    lines.push(
      `Kotvení: ${KOTVENI_LABELS[migrated.kotveni_typ]} (${KOTVENI_POVRCH_LABELS[migrated.kotveni_povrch]})`
    );
  }

  lines.push(formatLedBlockLine("LED wall na pódiu", migrated.led_podium));
  lines.push(formatLedBlockLine("LED branka vlevo", migrated.led_branka_vlevo));
  lines.push(formatLedBlockLine("LED branka vpravo", migrated.led_branka_vpravo));

  if (
    !anyLedWallBlockEnabled(migrated) &&
    migrated.led_pozadovano &&
    migrated.led_sirka_m &&
    migrated.led_vyska_m
  ) {
    lines.push(
      `LED (legacy): ${migrated.led_sirka_m} × ${migrated.led_vyska_m} m${migrated.led_umisteni ? `, ${LED_UM_LABELS[migrated.led_umisteni]}` : ""}`
    );
  }

  if (anyLedWallBlockEnabled(migrated) && migrated.led_obsluha_obsahu) {
    lines.push(`Obsluha LED obsahu: ${LED_OBSLUHA_LABELS[migrated.led_obsluha_obsahu]}`);
  }

  if (migrated.stage_typ === "zastresene") {
    if (migrated.zvuk_preset || migrated.zvuk_setup_id) {
      const preset = katalog.zvuk_presety.find((row) => row.kod === migrated.zvuk_preset);
      lines.push(`Zvuk: ${preset?.nazev ?? "vybraná sestava"}`);
    }
    if (migrated.svetla_preset || migrated.svetla_setup_id) {
      const preset = katalog.svetla_presety.find((row) => row.kod === migrated.svetla_preset);
      lines.push(`Světla: ${preset?.nazev ?? "vybraná sestava"}`);
    }
  }

  if (migrated.kamery_pocet > 0) {
    lines.push(`Kamery: ${migrated.kamery_pocet} ks (včetně obsluhy)`);
  }
  if (migrated.dron) lines.push("Dron: ano (včetně obsluhy)");
  if (migrated.poznamka) lines.push(`Poznámka: ${migrated.poznamka}`);
  return lines;
}

export function formatSestavaSummaryText(
  state: SestavaKonfiguratorState,
  katalog: PortalSestavaKatalog
): string {
  return buildSestavaSummaryLines(state, katalog).join("\n");
}
