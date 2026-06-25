"use client";

import { useMemo } from "react";
import PoptavkaSestavaSchema from "@/components/portal/PoptavkaSestavaSchema";
import {
  computeOdhadModulu,
  validateSestavaKonfigurator,
  buildSestavaSummaryLines,
} from "@/lib/client-portal/sestava-konfigurator-form";
import {
  findLedTyp,
  getMaxCistaVyska,
} from "@/lib/client-portal/sestava-konfigurator-katalog";
import type {
  PortalSestavaKatalog,
  SestavaKonfiguratorState,
  SchodyStrana,
} from "@/lib/client-portal/sestava-konfigurator-types";

type Props = {
  katalog: PortalSestavaKatalog;
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
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  readOnly?: boolean;
  inputClass: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={readOnly}
        className={inputClass}
      />
    </label>
  );
}

export default function PoptavkaSestavaKonfigurator({
  katalog,
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

  function patch(partial: Partial<SestavaKonfiguratorState>) {
    onChange({ ...state, ...partial });
  }

  function toggleSchodyStrana(strana: SchodyStrana) {
    const has = state.schody_strany.includes(strana);
    const next = has
      ? state.schody_strany.filter((s) => s !== strana)
      : [...state.schody_strany, strana];
    patch({ schody_strany: next.slice(0, 2) });
  }

  function selectLedTyp(kod: SestavaKonfiguratorState["led_typ_kod"]) {
    const led = findLedTyp(katalog, kod);
    patch({
      led_typ_kod: kod,
      led_pozadovano: Boolean(kod),
      led_sirka_m: led?.default_sirka_m ?? null,
      led_vyska_m: led?.default_vyska_m ?? null,
      led_umisteni: led?.je_mantinel ? "mantinel" : state.led_umisteni,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
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
                  placeholder="Popište nestandardní požadavek — např. LED pruh kolem budovy, LED kostka kolem IBC, atypická konstrukce…"
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
                    const defaults =
                      value === "mobilni"
                        ? {
                            zastreseni_sirka_m: katalog.mobilni_stage.default_sirka_m,
                            zastreseni_hloubka_m: katalog.mobilni_stage.default_hloubka_m,
                            zastreseni_variant_id: null,
                          }
                        : {
                            zastreseni_variant_id: katalog.zastreseni_varianty[0]?.id ?? null,
                          };
                    patch({ stage_typ: value, ...defaults });
                  }}
                  disabled={readOnly}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>

        {state.stage_typ === "zastresene" ? (
          <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-200/90">
              2. Rozměry zastřešení
            </h3>
            <label className="block space-y-1">
              <span className={labelClass}>Varianta zastřešení</span>
              <select
                value={state.zastreseni_variant_id ?? ""}
                onChange={(e) => patch({ zastreseni_variant_id: e.target.value || null })}
                disabled={readOnly}
                className={inputClass}
              >
                <option value="">— vyberte —</option>
                {katalog.zastreseni_varianty.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nazev} (max čistá výška {v.max_cista_vyska_m} m)
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Šířka zastřešení (m)"
                value={state.zastreseni_sirka_m}
                onChange={(v) => patch({ zastreseni_sirka_m: v })}
                readOnly={readOnly}
                inputClass={inputClass}
              />
              <NumberField
                label="Hloubka zastřešení (m)"
                value={state.zastreseni_hloubka_m}
                onChange={(v) => patch({ zastreseni_hloubka_m: v })}
                readOnly={readOnly}
                inputClass={inputClass}
              />
            </div>
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
              <NumberField
                label="Šířka pódia (m)"
                value={state.podium_sirka_m}
                onChange={(v) => patch({ podium_sirka_m: v })}
                readOnly={readOnly}
                inputClass={inputClass}
              />
              <NumberField
                label="Hloubka pódia (m)"
                value={state.podium_hloubka_m}
                onChange={(v) => patch({ podium_hloubka_m: v })}
                readOnly={readOnly}
                inputClass={inputClass}
              />
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
              6. Schody (vlevo / vpravo)
            </h3>
            <label className="block space-y-1">
              <span className={labelClass}>Počet schodišť</span>
              <select
                value={state.schody_pocet}
                onChange={(e) => patch({ schody_pocet: Number(e.target.value) })}
                disabled={readOnly}
                className={inputClass}
              >
                <option value={0}>Bez schodů</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
            {state.schody_pocet > 0 ? (
              <div className="flex flex-wrap gap-3">
                {(["vlevo", "vpravo"] as const).map((strana) => (
                  <label key={strana} className={optionCardClass}>
                    <input
                      type="checkbox"
                      checked={state.schody_strany.includes(strana)}
                      onChange={() => toggleSchodyStrana(strana)}
                      disabled={readOnly}
                    />
                    <span>{strana === "vlevo" ? "Vlevo" : "Vpravo"}</span>
                  </label>
                ))}
              </div>
            ) : null}
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
                    e.target.value === "zadny" ? null : katalog.praktikabl_varianty[1]?.id ?? null,
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
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={state.praktikabl_schudky}
                    onChange={(e) => patch({ praktikabl_schudky: e.target.checked })}
                    disabled={readOnly}
                  />
                  Malé schůdky / nástup
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
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["zatloukane", "Zatloukané kotvení"],
                  ["ibc_boxy", "Zátěž IBC boxy"],
                ] as const
              ).map(([value, label]) => (
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
            <input
              value={state.kotveni_povrch}
              onChange={(e) => patch({ kotveni_povrch: e.target.value })}
              disabled={readOnly}
              placeholder="Povrch (tráva, asfalt, beton…)"
              className={inputClass}
            />
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
              onChange={(e) => patch({ led_pozadovano: e.target.checked, led_typ_kod: e.target.checked ? state.led_typ_kod ?? "p3_9_outdoor" : null })}
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
                      {led.nazev} — max {led.max_plocha_m2.toFixed(1)} m² ({led.dostupnych_panelu}{" "}
                      panelů)
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  label="Šířka LED (m)"
                  value={state.led_sirka_m}
                  onChange={(v) => patch({ led_sirka_m: v })}
                  readOnly={readOnly}
                  inputClass={inputClass}
                />
                <NumberField
                  label="Výška LED (m)"
                  value={state.led_vyska_m}
                  onChange={(v) => patch({ led_vyska_m: v })}
                  readOnly={readOnly}
                  inputClass={inputClass}
                />
              </div>
              {selectedLed && state.led_sirka_m && state.led_vyska_m ? (
                <p className="text-xs text-slate-400">
                  Plocha {(state.led_sirka_m * state.led_vyska_m).toFixed(1)} m² · dostupné{" "}
                  {selectedLed.max_plocha_m2.toFixed(1)} m²
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["stack_na_podiu", "Stack na pódiu"],
                    ["mimo_stage_branka", "Mimo stage na brance"],
                    ["mantinel", "Mantinel (P6,4)"],
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
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={state.led_rohy}
                  onChange={(e) => patch({ led_rohy: e.target.checked })}
                  disabled={readOnly}
                />
                Rohy (pokud typ podporuje)
              </label>
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
              : "U zastřešení se PA zobrazí na PA wing (line array + sub)."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className={labelClass}>Zvuková sestava</span>
              <select
                value={state.zvuk_preset ?? ""}
                onChange={(e) =>
                  patch({ zvuk_preset: (e.target.value as typeof state.zvuk_preset) || null })
                }
                disabled={readOnly}
                className={inputClass}
              >
                <option value="">—</option>
                {katalog.zvuk_presety.map((p) => (
                  <option key={p.kod} value={p.kod}>
                    {p.nazev}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className={labelClass}>Světelná sestava</span>
              <select
                value={state.svetla_preset ?? ""}
                onChange={(e) =>
                  patch({ svetla_preset: (e.target.value as typeof state.svetla_preset) || null })
                }
                disabled={readOnly}
                className={inputClass}
              >
                <option value="">—</option>
                {katalog.svetla_presety.map((p) => (
                  <option key={p.kod} value={p.kod}>
                    {p.nazev}
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
              <p key={msg} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {msg}
              </p>
            ))}
            {validation.warnings.map((msg) => (
              <p key={msg} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {msg}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <PoptavkaSestavaSchema state={state} />
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
