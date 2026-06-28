"use client";

import { useMemo } from "react";
import SestavaLedWallBlock from "@/components/portal/SestavaLedWallBlock";
import {
  applySchodyVolba,
  computeOdhadModulu,
  normalizeSestavaStateForSave,
  schodyVolbaFromState,
  validateSestavaKonfigurator,
} from "@/lib/client-portal/sestava-konfigurator-form";
import { calculateIbcWaterRequirement } from "@/lib/client-portal/sestava-ibc-water";
import {
  buildMobilniStageVolby,
  buildSvetlaVolby,
  buildZastreseniVolby,
  buildZvukVolby,
  resolveZastreseniVolbaValue,
} from "@/lib/client-portal/sestava-konfigurator-options";
import {
  findPodiumVariant,
  findZastreseniVariant,
  findZastreseniVariantByNazev,
  getAvailableKotveniTypy,
  getMaxCistaVyska,
  getPodiumVolbyProZastreseni,
  getZastreseniHeightOptions,
  sanitizePodiumForZastreseni,
} from "@/lib/client-portal/sestava-konfigurator-katalog";
import type {
  LedWallBlock,
  PortalSestavaKatalog,
  PresetVelikost,
  SchodyVolba,
  SestavaKonfiguratorState,
} from "@/lib/client-portal/sestava-konfigurator-types";
import type { KonfiguratorVolba } from "@/lib/client-portal/sestava-konfigurator-options";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";
import {
  anyLedWallBlockEnabled,
  mobilniLedLimits,
  setLedBlock,
  type LedBlockKey,
} from "@/lib/client-portal/sestava-led-blocks";

type Props = {
  katalog: PortalSestavaKatalog;
  setupsByOblast: PortalSetupsByOblast;
  state: SestavaKonfiguratorState;
  onChange: (next: SestavaKonfiguratorState) => void;
  readOnly?: boolean;
  inputClass: string;
  labelClass: string;
  optionCardClass: string;
};

function selectZastreseniFromVolba(
  volba: KonfiguratorVolba,
  katalog: PortalSestavaKatalog
): Partial<SestavaKonfiguratorState> {
  if (volba.source === "setup") {
    const variant = findZastreseniVariantByNazev(katalog, volba.label);
    return {
      zastreseni_setup_id: volba.setup_id,
      zastreseni_variant_id: variant?.id ?? null,
      zastreseni_sirka_m: variant?.sirka_m ?? null,
      zastreseni_hloubka_m: variant?.hloubka_m ?? null,
    };
  }

  const variant = findZastreseniVariant(katalog, volba.value);
  return {
    zastreseni_variant_id: variant?.id ?? volba.value,
    zastreseni_setup_id: volba.setup_id,
    zastreseni_sirka_m: variant?.sirka_m ?? null,
    zastreseni_hloubka_m: variant?.hloubka_m ?? null,
  };
}

function selectPodiumFromVariant(
  katalog: PortalSestavaKatalog,
  variantId: string | null
): Partial<SestavaKonfiguratorState> {
  const variant = findPodiumVariant(katalog, variantId);
  if (!variant) {
    return {
      podium_variant_id: null,
      podium_setup_id: null,
      podium_sirka_m: null,
      podium_hloubka_m: null,
    };
  }
  return {
    podium_variant_id: variant.id,
    podium_setup_id: variant.setup_id ?? null,
    podium_sirka_m: variant.sirka_m,
    podium_hloubka_m: variant.hloubka_m,
  };
}

function selectZvukFromVolba(volba: KonfiguratorVolba): Partial<SestavaKonfiguratorState> {
  if (volba.source === "setup") {
    return { zvuk_setup_id: volba.setup_id, zvuk_preset: null };
  }
  return {
    zvuk_preset: volba.value as PresetVelikost,
    zvuk_setup_id: volba.setup_id,
  };
}

function selectSvetlaFromVolba(volba: KonfiguratorVolba): Partial<SestavaKonfiguratorState> {
  if (volba.source === "setup") {
    return { svetla_setup_id: volba.setup_id, svetla_preset: null };
  }
  return {
    svetla_preset: volba.value as PresetVelikost,
    svetla_setup_id: volba.setup_id,
  };
}

export default function PoptavkaSestavaKonfigurator({
  katalog,
  setupsByOblast,
  state,
  onChange,
  readOnly,
  inputClass,
  labelClass,
  optionCardClass,
}: Props) {
  const validation = useMemo(() => validateSestavaKonfigurator(state, katalog), [state, katalog]);
  const odhad = useMemo(() => computeOdhadModulu(katalog, state), [katalog, state]);
  const maxCista = getMaxCistaVyska(katalog, state.stage_typ, state.zastreseni_variant_id);
  const heightOptions = getZastreseniHeightOptions();
  const isMobilni = state.stage_typ === "mobilni";
  const isZastresene = state.stage_typ === "zastresene";
  const ledLimits = isMobilni ? mobilniLedLimits() : undefined;
  const anyLed = anyLedWallBlockEnabled(state);

  const zastreseniVolby = useMemo(
    () => buildZastreseniVolby(katalog, setupsByOblast),
    [katalog, setupsByOblast]
  );
  const mobilniVolby = useMemo(
    () => buildMobilniStageVolby(katalog, setupsByOblast),
    [katalog, setupsByOblast]
  );
  const zvukVolby = useMemo(
    () => buildZvukVolby(katalog, setupsByOblast),
    [katalog, setupsByOblast]
  );
  const svetlaVolby = useMemo(
    () => buildSvetlaVolby(katalog, setupsByOblast),
    [katalog, setupsByOblast]
  );

  const podiumVolby = useMemo(
    () => getPodiumVolbyProZastreseni(katalog, state.zastreseni_variant_id),
    [katalog, state.zastreseni_variant_id]
  );
  const kotveniOptions = getAvailableKotveniTypy(state.kotveni_povrch);
  const schodyVolba = schodyVolbaFromState(state);

  const zastreseniSelectedValue = useMemo(
    () => resolveZastreseniVolbaValue(zastreseniVolby, state, katalog),
    [zastreseniVolby, state, katalog]
  );
  const ibcWaterRequirement = useMemo(() => calculateIbcWaterRequirement(state), [state]);
  const zvukSelectedValue = state.zvuk_setup_id ?? state.zvuk_preset ?? "";
  const svetlaSelectedValue = state.svetla_setup_id ?? state.svetla_preset ?? "";

  function patch(partial: Partial<SestavaKonfiguratorState>) {
    onChange(normalizeSestavaStateForSave({ ...state, ...partial }));
  }

  function patchLedBlock(key: LedBlockKey, block: LedWallBlock) {
    onChange(normalizeSestavaStateForSave(setLedBlock(state, key, block)));
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
        <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
            Režim konfigurace
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["standard", "Standardní konfigurace"],
                ["atypicka", "Atypická poptávka / chci to popsat ručně"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={optionCardClass}>
                <input
                  type="radio"
                  name="sestava_rezim"
                  checked={state.rezim === value}
                  onChange={() =>
                    patch({
                      rezim: value,
                      atypicka_poptavka_text:
                        value === "atypicka" ? state.atypicka_poptavka_text : "",
                    })
                  }
                  disabled={readOnly}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          {state.rezim === "atypicka" ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-100">
                Atypické zadání posoudíme individuálně a techniku navrhneme ručně. Není potřeba
                vyplňovat standardní rozměry stage, LED ani pódia.
              </p>
              <label className="block space-y-2">
                <span className={labelClass}>Popis atypické technické poptávky *</span>
                <textarea
                  value={state.atypicka_poptavka_text}
                  onChange={(e) => patch({ atypicka_poptavka_text: e.target.value })}
                  disabled={readOnly}
                  rows={8}
                  className={inputClass}
                  placeholder="Popište nestandardní požadavek — např. LED pruh kolem budovy, atypická konstrukce…"
                />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Doplňující poznámka (volitelné)</span>
                <textarea
                  value={state.poznamka}
                  onChange={(e) => patch({ poznamka: e.target.value })}
                  disabled={readOnly}
                  rows={2}
                  className={inputClass}
                />
              </label>
            </div>
          ) : null}
        </section>

        {state.rezim === "standard" ? (
          <>
            <p className="rounded-lg border border-blue-500/40 bg-blue-500/15 px-4 py-3 text-sm font-medium text-blue-50">
              Všechny volby stran vlevo/vpravo jsou uváděné z pohledu diváka směrem na stage.
            </p>

            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                1. Typ stage / zastřešení
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["mobilni", "Mobilní stage"],
                    ["zastresene", "Zastřešené pódium"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className={optionCardClass}>
                    <input
                      type="radio"
                      name="sestava_stage_typ"
                      checked={state.stage_typ === value}
                      onChange={() => {
                        if (value === "mobilni") {
                          const first = mobilniVolby[0];
                          patch({
                            stage_typ: value,
                            zastreseni_variant_id: null,
                            zastreseni_setup_id: null,
                            zastreseni_sirka_m: null,
                            zastreseni_hloubka_m: null,
                            cista_vyska_m: null,
                            podium_variant_id: null,
                            podium_setup_id: null,
                            podium_sirka_m: null,
                            podium_hloubka_m: null,
                            podium_vyska_m: null,
                            schody_pocet: 0,
                            schody_strany: [],
                            mobilni_schody_strana: null,
                            zvuk_preset: null,
                            zvuk_setup_id: null,
                            svetla_preset: null,
                            svetla_setup_id: null,
                            mobilni_setup_id: first?.setup_id ?? null,
                          });
                        } else {
                          const first = zastreseniVolby[0];
                          patch({
                            stage_typ: value,
                            mobilni_setup_id: null,
                            mobilni_schody_strana: null,
                            mobilni_pozaduje_zvuk: false,
                            mobilni_pozaduje_svetla: false,
                            podium_variant_id: null,
                            podium_setup_id: null,
                            podium_sirka_m: null,
                            podium_hloubka_m: null,
                            podium_vyska_m: null,
                            ...selectZastreseniFromVolba(first, katalog),
                          });
                        }
                      }}
                      disabled={readOnly}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {state.stage_typ === "mobilni" && mobilniVolby.length > 1 ? (
                <label className="block space-y-1">
                  <span className={labelClass}>Varianta mobilní stage</span>
                  <select
                    value={state.mobilni_setup_id ?? mobilniVolby[0]?.value ?? ""}
                    onChange={(e) => {
                      const volba = mobilniVolby.find((row) => row.value === e.target.value);
                      patch({
                        mobilni_setup_id: volba?.setup_id ?? null,
                      });
                    }}
                    disabled={readOnly}
                    className={inputClass}
                  >
                    {mobilniVolby.map((volba) => (
                      <option key={volba.value} value={volba.value}>
                        {volba.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </section>

            {isZastresene ? (
              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                  2. Rozměr zastřešení
                </h3>
                <label className="block space-y-1">
                  <span className={labelClass}>Varianta zastřešení *</span>
                  <select
                    value={zastreseniSelectedValue}
                    onChange={(e) => {
                      const volba = zastreseniVolby.find((row) => row.value === e.target.value);
                      if (!volba) return;
                      const partial = selectZastreseniFromVolba(volba, katalog);
                      const nextVariantId = partial.zastreseni_variant_id ?? null;
                      patch({
                        ...partial,
                        ...sanitizePodiumForZastreseni(katalog, {
                          ...state,
                          zastreseni_variant_id: nextVariantId,
                        }),
                      });
                    }}
                    disabled={readOnly}
                    className={inputClass}
                  >
                    <option value="">— vyberte rozměr —</option>
                    {zastreseniVolby.map((volba) => (
                      <option key={volba.value} value={volba.value}>
                        {volba.label}
                      </option>
                    ))}
                  </select>
                </label>
                {state.zastreseni_sirka_m && state.zastreseni_hloubka_m ? (
                  <p className="text-xs text-slate-400">
                    Vybraný rozměr: {state.zastreseni_sirka_m} × {state.zastreseni_hloubka_m} m
                    {maxCista ? ` · max. čistá výška ${maxCista} m` : ""}
                  </p>
                ) : null}
              </section>
            ) : null}

            {isZastresene ? (
              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                  3. Čistá výška nad plochou pódia
                </h3>
                <label className="block space-y-1">
                  <span className={labelClass}>
                    Požadovaná čistá výška (m) *
                    {maxCista ? ` · max ${maxCista} m` : ""}
                  </span>
                  <select
                    value={state.cista_vyska_m ?? ""}
                    onChange={(e) =>
                      patch({
                        cista_vyska_m: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    disabled={readOnly}
                    className={inputClass}
                  >
                    <option value="">— vyberte výšku —</option>
                    {heightOptions.map((h) => (
                      <option key={h} value={h}>
                        {h} m
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            ) : null}

            {isZastresene ? (
              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                  4–5. Pódium — varianta a výška
                </h3>
                {!state.zastreseni_variant_id ? (
                  <p className="text-xs text-slate-500">Nejdříve vyberte variantu zastřešení.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-xs text-slate-400">Varianta pódia *</span>
                      <select
                        value={state.podium_variant_id ?? ""}
                        onChange={(e) =>
                          patch(selectPodiumFromVariant(katalog, e.target.value || null))
                        }
                        disabled={readOnly || podiumVolby.length === 0}
                        className={inputClass}
                      >
                        <option value="">— vyberte variantu —</option>
                        {podiumVolby.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.nazev}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-slate-400">Výška pódia (m) *</span>
                      <select
                        value={state.podium_vyska_m ?? ""}
                        onChange={(e) =>
                          patch({ podium_vyska_m: e.target.value ? Number(e.target.value) : null })
                        }
                        disabled={readOnly || !state.podium_variant_id}
                        className={inputClass}
                      >
                        <option value="">—</option>
                        {katalog.podium_vysky_m.map((h) => (
                          <option key={h} value={h}>
                            {h} m
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {odhad.podium_modulu > 0 ? (
                  <p className="text-xs text-slate-400">
                    Odhad: {odhad.podium_modulu} podlahových modulů ({katalog.podium_modul_sirka_m}×
                    {katalog.podium_modul_hloubka_m} m), cca {odhad.odhad_noh} nohou
                  </p>
                ) : null}
              </section>
            ) : null}

            {state.stage_typ ? (
              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                  {isMobilni ? "2. Schodiště" : "6. Schodiště"}
                </h3>
                {isMobilni ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["vlevo", "Schody zleva"],
                        ["vpravo", "Schody zprava"],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className={optionCardClass}>
                        <input
                          type="radio"
                          name="sestava_mobilni_schody"
                          checked={state.mobilni_schody_strana === value}
                          onChange={() =>
                            patch({
                              mobilni_schody_strana: value,
                              schody_pocet: 1,
                              schody_strany: [value],
                            })
                          }
                          disabled={readOnly}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <label className="block space-y-1">
                    <span className={labelClass}>Umístění schodiště</span>
                    <select
                      value={schodyVolba}
                      onChange={(e) => patch(applySchodyVolba(e.target.value as SchodyVolba))}
                      disabled={readOnly}
                      className={inputClass}
                    >
                      <option value="zadne">Bez schodiště</option>
                      <option value="vlevo">1× vlevo</option>
                      <option value="vpravo">1× vpravo</option>
                      <option value="vlevo_vpravo">2× vlevo i vpravo</option>
                    </select>
                  </label>
                )}
              </section>
            ) : null}

            {state.stage_typ ? (
              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                  7. Praktikábl / drum riser
                </h3>
                <select
                  value={state.praktikabl_typ}
                  onChange={(e) =>
                    patch({
                      praktikabl_typ: e.target.value as SestavaKonfiguratorState["praktikabl_typ"],
                      praktikabl_variant_id:
                        e.target.value === "zadny"
                          ? null
                          : (katalog.praktikabl_varianty[0]?.id ?? null),
                      praktikabl_umisteni: e.target.value === "zadny" ? null : state.praktikabl_umisteni,
                      praktikabl_mobilni: e.target.value === "zadny" ? false : state.praktikabl_mobilni,
                    })
                  }
                  disabled={readOnly}
                  className={inputClass}
                >
                  <option value="zadny">Bez praktikáblu</option>
                  <option value="bicí">Praktikábl pro bicí</option>
                  <option value="jiny">Jiný praktikábl</option>
                </select>
                {state.praktikabl_typ !== "zadny" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className={labelClass}>Velikost</span>
                      <select
                        value={state.praktikabl_variant_id ?? ""}
                        onChange={(e) => {
                          const variant = katalog.praktikabl_varianty.find(
                            (row) => row.id === e.target.value
                          );
                          patch({
                            praktikabl_variant_id: e.target.value || null,
                            praktikabl_vyska_m: variant?.vyska_m ?? state.praktikabl_vyska_m,
                          });
                        }}
                        disabled={readOnly}
                        className={inputClass}
                      >
                        {katalog.praktikabl_varianty.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.nazev}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className={labelClass}>Umístění</span>
                      <select
                        value={state.praktikabl_umisteni ?? ""}
                        onChange={(e) =>
                          patch({
                            praktikabl_umisteni:
                              (e.target.value as SestavaKonfiguratorState["praktikabl_umisteni"]) ||
                              null,
                          })
                        }
                        disabled={readOnly}
                        className={inputClass}
                      >
                        <option value="">—</option>
                        <option value="stred_vzadu">Střed vzadu</option>
                        <option value="vlevo_vzadu">Vlevo vzadu</option>
                        <option value="vpravo_vzadu">Vpravo vzadu</option>
                        <option value="vlastni">Vlastní / poznámka</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={state.praktikabl_schudky}
                        onChange={(e) => patch({ praktikabl_schudky: e.target.checked })}
                        disabled={readOnly}
                      />
                      Malé schůdky / nástup
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={state.praktikabl_mobilni}
                        onChange={(e) => patch({ praktikabl_mobilni: e.target.checked })}
                        disabled={readOnly}
                      />
                      Mobilní praktikábl pro rychlou výměnu kapel
                    </label>
                  </div>
                ) : null}
              </section>
            ) : null}

            {state.stage_typ ? (
              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                  8. Kotvení / zatížení
                </h3>
                <label className="block space-y-1">
                  <span className={labelClass}>Povrch *</span>
                  <select
                    value={state.kotveni_povrch ?? ""}
                    onChange={(e) => {
                      const povrch =
                        (e.target.value as SestavaKonfiguratorState["kotveni_povrch"]) || null;
                      const allowed = getAvailableKotveniTypy(povrch);
                      patch({
                        kotveni_povrch: povrch,
                        kotveni_typ:
                          state.kotveni_typ && allowed.includes(state.kotveni_typ)
                            ? state.kotveni_typ
                            : null,
                      });
                    }}
                    disabled={readOnly}
                    className={inputClass}
                  >
                    <option value="">— vyberte povrch —</option>
                    <option value="trava_hlina">Tráva / hlína</option>
                    <option value="asfalt_beton">Asfalt / beton</option>
                  </select>
                </label>
                {state.kotveni_povrch ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["zatloukane", "Zatloukané kotvení"],
                        ["ibc_boxy", "Zátěž IBC boxy"],
                      ] as const
                    )
                      .filter(([value]) => kotveniOptions.includes(value))
                      .map(([value, label]) => (
                        <label key={value} className={optionCardClass}>
                          <input
                            type="radio"
                            name="sestava_kotveni_typ"
                            checked={state.kotveni_typ === value}
                            onChange={() => patch({ kotveni_typ: value })}
                            disabled={readOnly}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                  </div>
                ) : null}
                {ibcWaterRequirement ? (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    {ibcWaterRequirement.text}
                  </p>
                ) : state.kotveni_typ === "ibc_boxy" ? (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    Pořadatel musí zajistit vodu pro naplnění zátěže.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                LED wall
              </h3>
              {isMobilni ? (
                <p className="text-xs text-slate-400">
                  U mobilní stage je maximální rozměr každé LED {ledLimits?.maxSirka} ×{" "}
                  {ledLimits?.maxVyska} m.
                </p>
              ) : null}
              <div className="space-y-2">
                <SestavaLedWallBlock
                  blockKey="podium"
                  block={state.led_podium}
                  readOnly={readOnly}
                  inputClass={inputClass}
                  labelClass={labelClass}
                  maxSirka={ledLimits?.maxSirka}
                  maxVyska={ledLimits?.maxVyska}
                  onChange={(block) => patchLedBlock("podium", block)}
                />
                <SestavaLedWallBlock
                  blockKey="branka_vlevo"
                  block={state.led_branka_vlevo}
                  readOnly={readOnly}
                  inputClass={inputClass}
                  labelClass={labelClass}
                  maxSirka={ledLimits?.maxSirka}
                  maxVyska={ledLimits?.maxVyska}
                  onChange={(block) => patchLedBlock("branka_vlevo", block)}
                />
                <SestavaLedWallBlock
                  blockKey="branka_vpravo"
                  block={state.led_branka_vpravo}
                  readOnly={readOnly}
                  inputClass={inputClass}
                  labelClass={labelClass}
                  maxSirka={ledLimits?.maxSirka}
                  maxVyska={ledLimits?.maxVyska}
                  onChange={(block) => patchLedBlock("branka_vpravo", block)}
                />
              </div>
              {anyLed ? (
                <div className="space-y-2">
                  <span className={labelClass}>Obsluha obsahu LED wall</span>
                  {(
                    [
                      ["klient_sam", "Klient obsluhuje obsah sám (technické zajištění námi)"],
                      ["nase_obsahu", "Naše obsluha obsahu po celou akci"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className={optionCardClass}>
                      <input
                        type="radio"
                        name="sestava_led_obsluha"
                        checked={state.led_obsluha_obsahu === value}
                        onChange={() => patch({ led_obsluha_obsahu: value })}
                        disabled={readOnly}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                Zvuk a světla
              </h3>
              {isMobilni ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Konkrétní sestavu ozvučení a osvětlení doplníme podle typu akce.
                  </p>
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={state.mobilni_pozaduje_zvuk}
                      onChange={(e) => patch({ mobilni_pozaduje_zvuk: e.target.checked })}
                      disabled={readOnly}
                    />
                    Požaduji ozvučení
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={state.mobilni_pozaduje_svetla}
                      onChange={(e) => patch({ mobilni_pozaduje_svetla: e.target.checked })}
                      disabled={readOnly}
                    />
                    Požaduji osvětlení
                  </label>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    {isZastresene
                      ? "U zastřešení se PA zobrazí na PA wing (line array + sub)."
                      : "Vyberte velikost zvukové a světelné sestavy."}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className={labelClass}>Zvuková sestava</span>
                      <select
                        value={zvukSelectedValue}
                        onChange={(e) => {
                          const volba = zvukVolby.find((row) => row.value === e.target.value);
                          if (!volba) {
                            patch({ zvuk_preset: null, zvuk_setup_id: null });
                            return;
                          }
                          patch(selectZvukFromVolba(volba));
                        }}
                        disabled={readOnly}
                        className={inputClass}
                      >
                        <option value="">—</option>
                        {zvukVolby.map((volba) => (
                          <option key={volba.value} value={volba.value}>
                            {volba.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className={labelClass}>Světelná sestava</span>
                      <select
                        value={svetlaSelectedValue}
                        onChange={(e) => {
                          const volba = svetlaVolby.find((row) => row.value === e.target.value);
                          if (!volba) {
                            patch({ svetla_preset: null, svetla_setup_id: null });
                            return;
                          }
                          patch(selectSvetlaFromVolba(volba));
                        }}
                        disabled={readOnly}
                        className={inputClass}
                      >
                        <option value="">—</option>
                        {svetlaVolby.map((volba) => (
                          <option key={volba.value} value={volba.value}>
                            {volba.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}
            </section>

            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                14. Kamery / dron
              </h3>
              <p className="text-xs text-slate-500">
                {katalog.kamery_dron.poznamka || "Kamery a dron jsou vždy včetně naší obsluhy."}
              </p>
              <label className="block space-y-1">
                <span className={labelClass}>Počet kamer</span>
                <select
                  value={state.kamery_pocet}
                  onChange={(e) => patch({ kamery_pocet: Number(e.target.value) })}
                  disabled={readOnly}
                  className={inputClass}
                >
                  <option value={0}>Bez kamer</option>
                  {Array.from({ length: katalog.kamery_dron.max_pocet_kamer }, (_, i) => i + 1).map(
                    (count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    )
                  )}
                </select>
              </label>
              {katalog.kamery_dron.dron_povolen ? (
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={state.dron}
                    onChange={(e) => patch({ dron: e.target.checked })}
                    disabled={readOnly}
                  />
                  Dron (včetně obsluhy)
                </label>
              ) : null}
            </section>
          </>
        ) : null}

        {validation.warnings.length > 0 || validation.errors.length > 0 ? (
          <div className="space-y-2">
            {validation.errors.map((msg) => (
              <p
                key={msg}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100"
              >
                {msg}
              </p>
            ))}
            {validation.warnings.map((msg) => (
              <p
                key={msg}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
              >
                {msg}
              </p>
            ))}
          </div>
        ) : null}
    </div>
  );
}
