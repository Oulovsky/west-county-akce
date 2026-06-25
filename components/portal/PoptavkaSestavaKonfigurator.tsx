"use client";

import { useMemo } from "react";
import PoptavkaSestavaSchema from "@/components/portal/PoptavkaSestavaSchema";
import {
  applySchodyVolba,
  computeOdhadModulu,
  schodyVolbaFromState,
  validateSestavaKonfigurator,
  buildSestavaSummaryLines,
} from "@/lib/client-portal/sestava-konfigurator-form";
import {
  buildMobilniStageVolby,
  buildSvetlaVolby,
  buildZastreseniVolby,
  buildZvukVolby,
} from "@/lib/client-portal/sestava-konfigurator-options";
import {
  buildPodiumMeterOptions,
  findLedTyp,
  findZastreseniVariant,
  getAvailableKotveniTypy,
  getMaxCistaVyska,
} from "@/lib/client-portal/sestava-konfigurator-katalog";
import type {
  PortalSestavaKatalog,
  PresetVelikost,
  SchodyVolba,
  SestavaKonfiguratorState,
} from "@/lib/client-portal/sestava-konfigurator-types";
import type { KonfiguratorVolba } from "@/lib/client-portal/sestava-konfigurator-options";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";

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

function NumberField({
  label,
  value,
  onChange,
  readOnly,
  inputClass,
  min,
  max,
  step = 0.1,
  required,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  readOnly?: boolean;
  inputClass: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={readOnly}
        className={inputClass}
      />
    </label>
  );
}

function selectZastreseniFromVolba(
  volba: KonfiguratorVolba,
  katalog: PortalSestavaKatalog
): Partial<SestavaKonfiguratorState> {
  if (volba.source === "setup") {
    return {
      zastreseni_setup_id: volba.setup_id,
      zastreseni_variant_id: null,
      zastreseni_sirka_m: null,
      zastreseni_hloubka_m: null,
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
  const summary = useMemo(() => buildSestavaSummaryLines(state, katalog), [state, katalog]);
  const odhad = useMemo(() => computeOdhadModulu(katalog, state), [katalog, state]);
  const maxCista = getMaxCistaVyska(katalog, state.stage_typ, state.zastreseni_variant_id);
  const selectedLed = findLedTyp(katalog, state.led_typ_kod);

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

  const roofW = state.zastreseni_sirka_m ?? katalog.mobilni_stage.default_sirka_m;
  const roofD = state.zastreseni_hloubka_m ?? katalog.mobilni_stage.default_hloubka_m;
  const podiumSirkaOptions = buildPodiumMeterOptions(roofW);
  const podiumHloubkaOptions = buildPodiumMeterOptions(roofD);
  const kotveniOptions = getAvailableKotveniTypy(state.kotveni_povrch);
  const schodyVolba = schodyVolbaFromState(state);

  const zastreseniSelectedValue =
    state.zastreseni_setup_id ?? state.zastreseni_variant_id ?? "";
  const zvukSelectedValue = state.zvuk_setup_id ?? state.zvuk_preset ?? "";
  const svetlaSelectedValue = state.svetla_setup_id ?? state.svetla_preset ?? "";

  function patch(partial: Partial<SestavaKonfiguratorState>) {
    onChange({ ...state, ...partial });
  }

  function selectLedTyp(kod: SestavaKonfiguratorState["led_typ_kod"]) {
    const led = findLedTyp(katalog, kod);
    patch({
      led_typ_kod: kod,
      led_pozadovano: Boolean(kod),
      led_sirka_m: led?.default_sirka_m ?? null,
      led_vyska_m: led?.default_vyska_m ?? null,
      led_umisteni: led?.je_mantinel ? "mantinel" : state.led_umisteni,
      led_rohy: led?.podporuje_rohy ? state.led_rohy : false,
    });
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
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
                            zastreseni_sirka_m: katalog.mobilni_stage.default_sirka_m,
                            zastreseni_hloubka_m: katalog.mobilni_stage.default_hloubka_m,
                            mobilni_setup_id: first?.setup_id ?? null,
                          });
                        } else {
                          const first = zastreseniVolby[0];
                          patch({
                            stage_typ: value,
                            mobilni_setup_id: null,
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

            {state.stage_typ === "zastresene" ? (
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
                      patch(selectZastreseniFromVolba(volba, katalog));
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

            {state.stage_typ ? (
              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                  3. Čistá výška nad plochou pódia
                </h3>
                <NumberField
                  label={`Požadovaná čistá výška (m)${maxCista ? ` · max ${maxCista} m` : ""}`}
                  value={state.cista_vyska_m}
                  onChange={(v) => patch({ cista_vyska_m: v })}
                  readOnly={readOnly}
                  inputClass={inputClass}
                  max={maxCista ?? undefined}
                />
              </section>
            ) : null}

            {state.stage_typ ? (
              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                  4–5. Pódium — rozměry a výška
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-400">Šířka pódia (m)</span>
                    <select
                      value={state.podium_sirka_m ?? ""}
                      onChange={(e) =>
                        patch({
                          podium_sirka_m: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      disabled={readOnly}
                      className={inputClass}
                    >
                      <option value="">—</option>
                      {podiumSirkaOptions.map((m) => (
                        <option key={m} value={m}>
                          {m} m
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-400">Hloubka pódia (m)</span>
                    <select
                      value={state.podium_hloubka_m ?? ""}
                      onChange={(e) =>
                        patch({
                          podium_hloubka_m: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      disabled={readOnly}
                      className={inputClass}
                    >
                      <option value="">—</option>
                      {podiumHloubkaOptions.map((m) => (
                        <option key={m} value={m}>
                          {m} m
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-400">Výška pódia (m)</span>
                    <select
                      value={state.podium_vyska_m ?? ""}
                      onChange={(e) =>
                        patch({ podium_vyska_m: e.target.value ? Number(e.target.value) : null })
                      }
                      disabled={readOnly}
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
                  6. Schodiště
                </h3>
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
                          : (katalog.praktikabl_varianty[1]?.id ?? null),
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
                {state.kotveni_typ === "ibc_boxy" ? (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    Pořadatel musí zajistit vodu pro naplnění zátěže.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                9–11. LED wall
              </h3>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={state.led_pozadovano}
                  onChange={(e) =>
                    patch({
                      led_pozadovano: e.target.checked,
                      led_typ_kod: e.target.checked ? (state.led_typ_kod ?? "p3_9_outdoor") : null,
                    })
                  }
                  disabled={readOnly}
                />
                Požaduji LED wall
              </label>
              {state.led_pozadovano ? (
                <>
                  <label className="block space-y-1">
                    <span className={labelClass}>Typ / pitch</span>
                    <select
                      value={state.led_typ_kod ?? ""}
                      onChange={(e) =>
                        selectLedTyp(e.target.value as SestavaKonfiguratorState["led_typ_kod"])
                      }
                      disabled={readOnly}
                      className={inputClass}
                    >
                      {katalog.led_typy.map((led) => (
                        <option key={led.kod} value={led.kod}>
                          {led.nazev}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberField
                      label="Šířka LED (m) *"
                      value={state.led_sirka_m}
                      onChange={(v) => patch({ led_sirka_m: v })}
                      readOnly={readOnly}
                      inputClass={inputClass}
                      required
                    />
                    <NumberField
                      label="Výška LED (m) *"
                      value={state.led_vyska_m}
                      onChange={(v) => patch({ led_vyska_m: v })}
                      readOnly={readOnly}
                      inputClass={inputClass}
                      required
                    />
                  </div>
                  {selectedLed && state.led_sirka_m && state.led_vyska_m ? (
                    <p className="text-xs text-slate-400">
                      Požadovaná plocha {(state.led_sirka_m * state.led_vyska_m).toFixed(1)} m²
                      {!selectedLed.je_mantinel
                        ? ` · max. ${selectedLed.max_plocha_m2.toFixed(1)} m²`
                        : ""}
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["stack_na_podiu", "Stack na pódiu"],
                        ["mimo_stage_branka", "Mimo stage na brance"],
                        ...(selectedLed?.je_mantinel || state.led_typ_kod === "p6_4_mantel"
                          ? ([["mantinel", "Mantinel P6,4"]] as const)
                          : []),
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className={optionCardClass}>
                        <input
                          type="radio"
                          name="sestava_led_umisteni"
                          checked={state.led_umisteni === value}
                          onChange={() => patch({ led_umisteni: value })}
                          disabled={readOnly}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  {selectedLed?.podporuje_rohy ? (
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={state.led_rohy}
                        onChange={(e) => patch({ led_rohy: e.target.checked })}
                        disabled={readOnly}
                      />
                      Rohové panely
                    </label>
                  ) : null}
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
                </>
              ) : null}
            </section>

            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
                12–13. Zvuk a světla
              </h3>
              <p className="text-xs text-slate-500">
                {state.stage_typ === "mobilni"
                  ? "U mobilní stage se PA zobrazí na stativech."
                  : state.stage_typ === "zastresene"
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

      <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto">
        <PoptavkaSestavaSchema state={state} katalog={katalog} />
        {summary.length > 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-300">
            <div className="mb-2 font-semibold uppercase tracking-wide text-slate-400">
              Shrnutí sestavy
            </div>
            <ul className="space-y-1">
              {summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
