import {
  computePodiumModuly,
  estimatePodiumLegs,
  findLedTyp,
  findPraktikablVariant,
  findZastreseniVariant,
  getMaxCistaVyska,
} from "@/lib/client-portal/sestava-konfigurator-katalog";
import type {
  KotveniTyp,
  LedObsluhaObsahu,
  LedTypKod,
  LedUmisteni,
  PortalSestavaKatalog,
  PraktikablTyp,
  PraktikablUmisteni,
  PresetVelikost,
  SchodyStrana,
  SestavaKonfiguratorState,
  SestavaKonfiguratorValidation,
  SestavaOdhadModulu,
  StageTyp,
} from "@/lib/client-portal/sestava-konfigurator-types";
import type { PoptavkaSetupInput } from "@/lib/client-portal/poptavka-form";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";

export const EMPTY_SESTAVA_KONFIGURATOR: SestavaKonfiguratorState = {
  rezim: "standard",
  atypicka_poptavka_text: "",
  stage_typ: null,
  zastreseni_variant_id: null,
  zastreseni_sirka_m: null,
  zastreseni_hloubka_m: null,
  cista_vyska_m: null,
  podium_sirka_m: null,
  podium_hloubka_m: null,
  podium_vyska_m: null,
  schody_pocet: 1,
  schody_strany: ["vlevo"],
  praktikabl_typ: "zadny",
  praktikabl_variant_id: null,
  praktikabl_vyska_m: null,
  praktikabl_umisteni: null,
  praktikabl_schudky: true,
  praktikabl_poznamka: "",
  kotveni_typ: null,
  kotveni_povrch: "",
  led_pozadovano: false,
  led_typ_kod: null,
  led_sirka_m: null,
  led_vyska_m: null,
  led_umisteni: null,
  led_rohy: false,
  led_obsluha_obsahu: null,
  zvuk_preset: null,
  svetla_preset: null,
  kamery_pocet: 0,
  dron: false,
  poznamka: "",
};

const STAGE_TYP_VALUES: StageTyp[] = ["mobilni", "zastresene"];
const SCHODY_STRANY: SchodyStrana[] = ["vlevo", "vpravo"];
const KOTVENI: KotveniTyp[] = ["zatloukane", "ibc_boxy"];
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

export function sestavaFromOdpovediExtra(
  extra: Record<string, unknown> | null | undefined
): SestavaKonfiguratorState {
  const raw = extra?.sestava_konfigurator;
  if (!raw || typeof raw !== "object") return { ...EMPTY_SESTAVA_KONFIGURATOR };
  const data = raw as Partial<SestavaKonfiguratorState>;
  return {
    ...EMPTY_SESTAVA_KONFIGURATOR,
    ...data,
    rezim: data.rezim === "atypicka" ? "atypicka" : "standard",
    atypicka_poptavka_text: String(data.atypicka_poptavka_text ?? "").trim(),
    schody_strany: parseSchodyStrany(data.schody_strany),
    schody_pocet: Math.max(0, Math.min(2, Number(data.schody_pocet ?? 1) || 0)),
    kamery_pocet: Math.max(0, Math.min(3, Number(data.kamery_pocet ?? 0) || 0)),
  };
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

  return {
    rezim: parseEnum(formData.get("sestava_rezim"), ["standard", "atypicka"] as const) ?? "standard",
    atypicka_poptavka_text: String(formData.get("sestava_atypicka_text") ?? "").trim(),
    stage_typ: parseEnum(formData.get("sestava_stage_typ"), STAGE_TYP_VALUES),
    zastreseni_variant_id: String(formData.get("sestava_zastreseni_variant") ?? "").trim() || null,
    zastreseni_sirka_m: parseNumber(formData.get("sestava_zastreseni_sirka_m")),
    zastreseni_hloubka_m: parseNumber(formData.get("sestava_zastreseni_hloubka_m")),
    cista_vyska_m: parseNumber(formData.get("sestava_cista_vyska_m")),
    podium_sirka_m: parseNumber(formData.get("sestava_podium_sirka_m")),
    podium_hloubka_m: parseNumber(formData.get("sestava_podium_hloubka_m")),
    podium_vyska_m: parseNumber(formData.get("sestava_podium_vyska_m")),
    schody_pocet: Math.max(0, Math.min(2, parseNumber(formData.get("sestava_schody_pocet")) ?? 1)),
    schody_strany: parseSchodyStrany(formData.get("sestava_schody_strany")),
    praktikabl_typ: parseEnum(formData.get("sestava_praktikabl_typ"), PRACTIKABL) ?? "zadny",
    praktikabl_variant_id:
      String(formData.get("sestava_praktikabl_variant") ?? "").trim() || null,
    praktikabl_vyska_m: parseNumber(formData.get("sestava_praktikabl_vyska_m")),
    praktikabl_umisteni: parseEnum(formData.get("sestava_praktikabl_umisteni"), PRACTIKABL_UM),
    praktikabl_schudky: parseBool(formData.get("sestava_praktikabl_schudky")),
    praktikabl_poznamka: String(formData.get("sestava_praktikabl_poznamka") ?? "").trim(),
    kotveni_typ: parseEnum(formData.get("sestava_kotveni_typ"), KOTVENI),
    kotveni_povrch: String(formData.get("sestava_kotveni_povrch") ?? "").trim(),
    led_pozadovano: parseBool(formData.get("sestava_led_pozadovano")),
    led_typ_kod: parseEnum(formData.get("sestava_led_typ_kod"), LED_KOD),
    led_sirka_m: parseNumber(formData.get("sestava_led_sirka_m")),
    led_vyska_m: parseNumber(formData.get("sestava_led_vyska_m")),
    led_umisteni: parseEnum(formData.get("sestava_led_umisteni"), LED_UM),
    led_rohy: parseBool(formData.get("sestava_led_rohy")),
    led_obsluha_obsahu: parseEnum(formData.get("sestava_led_obsluha"), LED_OBSLUHA),
    zvuk_preset: parseEnum(formData.get("sestava_zvuk_preset"), PRESET),
    svetla_preset: parseEnum(formData.get("sestava_svetla_preset"), PRESET),
    kamery_pocet: Math.max(
      0,
      Math.min(3, parseNumber(formData.get("sestava_kamery_pocet")) ?? 0)
    ),
    dron: parseBool(formData.get("sestava_dron")),
    poznamka: String(formData.get("sestava_poznamka") ?? "").trim(),
  };
}

export function buildSestavaOdpovediExtra(state: SestavaKonfiguratorState) {
  return { sestava_konfigurator: state };
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
    warnings.push("Nebyl zvolen typ stage / zastřešení.");
    return { warnings, errors };
  }

  const maxVyska = getMaxCistaVyska(
    katalog,
    state.stage_typ,
    state.zastreseni_variant_id
  );

  if (state.stage_typ === "zastresene") {
    const variant = findZastreseniVariant(katalog, state.zastreseni_variant_id);
    if (!variant) {
      errors.push("Vyberte variantu zastřešení.");
    } else if (state.zastreseni_sirka_m != null) {
      if (
        state.zastreseni_sirka_m < variant.min_sirka_m ||
        state.zastreseni_sirka_m > variant.max_sirka_m
      ) {
        warnings.push(
          `Šířka zastřešení ${state.zastreseni_sirka_m} m je mimo rozsah ${variant.min_sirka_m}–${variant.max_sirka_m} m pro ${variant.nazev}.`
        );
      }
    }
  }

  if (state.cista_vyska_m != null && maxVyska != null && state.cista_vyska_m > maxVyska) {
    warnings.push(
      `Požadovaná čistá výška ${state.cista_vyska_m} m překračuje maximum ${maxVyska} m pro zvolené zastřešení. Zvažte větší variantu.`
    );
  }

  if (state.podium_sirka_m && state.zastreseni_sirka_m && state.podium_sirka_m > state.zastreseni_sirka_m) {
    warnings.push("Pódium je širší než zastřešení — zkontrolujte rozměry.");
  }
  if (
    state.podium_hloubka_m &&
    state.zastreseni_hloubka_m &&
    state.podium_hloubka_m > state.zastreseni_hloubka_m
  ) {
    warnings.push("Pódium je hlubší než zastřešení — zkontrolujte rozměry.");
  }

  if (state.schody_pocet > 0 && state.schody_strany.length === 0) {
    errors.push("U schodů zvolte umístění vlevo nebo vpravo.");
  }

  if (state.praktikabl_typ !== "zadny" && !state.praktikabl_umisteni) {
    errors.push("U praktikáblu zvolte umístění.");
  }

  if (state.kotveni_typ === "ibc_boxy") {
    warnings.push("Pořadatel musí zajistit vodu pro naplnění zátěže (IBC boxy).");
  }

  if (state.led_pozadovano) {
    if (!state.led_typ_kod) errors.push("U LED wall vyberte typ panelu.");
    if (!state.led_umisteni) errors.push("U LED wall zvolte umístění.");
    if (!state.led_obsluha_obsahu) errors.push("U LED wall zvolte způsob obsluhy obsahu.");

    const led = findLedTyp(katalog, state.led_typ_kod);
    if (led && state.led_sirka_m && state.led_vyska_m) {
      const area = state.led_sirka_m * state.led_vyska_m;
      if (area > led.max_plocha_m2 + 0.01) {
        warnings.push(
          `Požadovaná plocha LED ${area.toFixed(1)} m² překračuje dostupných ${led.max_plocha_m2.toFixed(1)} m² (${led.dostupnych_panelu} panelů).`
        );
      }
    }

    if (state.led_umisteni === "mantinel" && state.led_typ_kod !== "p6_4_mantel") {
      warnings.push("Mantinel je typicky pro P6,4 — zkontrolujte volbu typu LED.");
    }
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
    pushSetup(findByOblastNazev("stage", "mobil"));
  } else if (state.stage_typ === "zastresene") {
    const variant = findZastreseniVariant(katalog, state.zastreseni_variant_id);
    pushSetup(findByOblastNazev("stage", variant?.id ?? "zastřeš"));
  }

  if (state.podium_sirka_m && state.podium_hloubka_m) {
    pushSetup(findByOblastNazev("stage", "pódium") ?? findByOblastNazev("stage", "podium"));
  }

  if (state.praktikabl_typ !== "zadny") {
    pushSetup(findByOblastNazev("stage", "praktikábl") ?? findByOblastNazev("stage", "riser"));
  }

  if (state.led_pozadovano && state.led_typ_kod) {
    const preset = katalog.led_typy.find((row) => row.kod === state.led_typ_kod);
    pushSetup(findByOblastNazev("led_wall", preset?.pixel_pitch ?? "led"));
  }

  if (state.zvuk_preset) {
    const preset = katalog.zvuk_presety.find((row) => row.kod === state.zvuk_preset);
    pushSetup(preset?.setup_id ?? findByOblastNazev("sound", state.zvuk_preset));
  }

  if (state.svetla_preset) {
    const preset = katalog.svetla_presety.find((row) => row.kod === state.svetla_preset);
    pushSetup(preset?.setup_id ?? findByOblastNazev("lights", state.svetla_preset));
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

const LED_UM_LABELS: Record<LedUmisteni, string> = {
  stack_na_podiu: "Stack na pódiu",
  mimo_stage_branka: "Mimo stage na brance",
  mantinel: "Mantinel",
};

const LED_OBSLUHA_LABELS: Record<LedObsluhaObsahu, string> = {
  klient_sam: "Obsah obsluhuje klient (technické zajištění námi)",
  nase_obsahu: "Naše obsluha LED obsahu po celou akci",
};

export function buildSestavaSummaryLines(
  state: SestavaKonfiguratorState,
  katalog: PortalSestavaKatalog
): string[] {
  const lines: string[] = [];

  if (state.rezim === "atypicka") {
    lines.push("Atypická technická poptávka — ruční návrh a nacenění");
    if (state.atypicka_poptavka_text.trim()) {
      lines.push(state.atypicka_poptavka_text.trim());
    }
    if (state.poznamka) lines.push(`Poznámka: ${state.poznamka}`);
    return lines;
  }

  if (!state.stage_typ) return lines;

  lines.push(`Stage: ${STAGE_LABELS[state.stage_typ]}`);
  if (state.stage_typ === "zastresene") {
    const v = findZastreseniVariant(katalog, state.zastreseni_variant_id);
    if (v) lines.push(`Zastřešení: ${v.nazev}`);
    if (state.zastreseni_sirka_m && state.zastreseni_hloubka_m) {
      lines.push(
        `Rozměr zastřešení: ${state.zastreseni_sirka_m} × ${state.zastreseni_hloubka_m} m`
      );
    }
  }
  if (state.cista_vyska_m) lines.push(`Čistá výška nad pódiem: ${state.cista_vyska_m} m`);
  if (state.podium_sirka_m && state.podium_hloubka_m) {
    lines.push(
      `Pódium: ${state.podium_sirka_m} × ${state.podium_hloubka_m} m, výška ${state.podium_vyska_m ?? "—"} m`
    );
    const odhad = computeOdhadModulu(katalog, state);
    if (odhad.podium_modulu > 0) {
      lines.push(
        `Odhad podlahy: ${odhad.podium_modulu} modulů, cca ${odhad.odhad_noh} nohou, ${odhad.odhad_schodu} schodiště`
      );
    }
  }
  if (state.schody_pocet > 0 && state.schody_strany.length) {
    lines.push(`Schody: ${state.schody_pocet}× (${state.schody_strany.join(", ")})`);
  }
  if (state.praktikabl_typ !== "zadny") {
    const pv = findPraktikablVariant(katalog, state.praktikabl_variant_id);
    lines.push(
      `Praktikábl: ${state.praktikabl_typ}${pv ? ` ${pv.nazev}` : ""}, umístění ${state.praktikabl_umisteni ?? "—"}`
    );
  }
  if (state.kotveni_typ) {
    lines.push(`Kotvení: ${KOTVENI_LABELS[state.kotveni_typ]}${state.kotveni_povrch ? ` (${state.kotveni_povrch})` : ""}`);
  }
  if (state.led_pozadovano && state.led_typ_kod) {
    const led = findLedTyp(katalog, state.led_typ_kod);
    lines.push(
      `LED: ${led?.nazev ?? state.led_typ_kod}, ${state.led_sirka_m ?? "?"} × ${state.led_vyska_m ?? "?"} m, ${state.led_umisteni ? LED_UM_LABELS[state.led_umisteni] : ""}`
    );
    if (state.led_obsluha_obsahu) {
      lines.push(`Obsluha LED obsahu: ${LED_OBSLUHA_LABELS[state.led_obsluha_obsahu]}`);
    }
  }
  if (state.zvuk_preset) lines.push(`Zvuk: ${state.zvuk_preset}`);
  if (state.svetla_preset) lines.push(`Světla: ${state.svetla_preset}`);
  if (state.kamery_pocet > 0) {
    lines.push(`Kamery: ${state.kamery_pocet} ks (včetně obsluhy)`);
  }
  if (state.dron) lines.push("Dron: ano (včetně obsluhy)");
  if (state.poznamka) lines.push(`Poznámka: ${state.poznamka}`);
  return lines;
}

export function formatSestavaSummaryText(
  state: SestavaKonfiguratorState,
  katalog: PortalSestavaKatalog
): string {
  return buildSestavaSummaryLines(state, katalog).join("\n");
}
