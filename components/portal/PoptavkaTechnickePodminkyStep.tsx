"use client";

import { useMemo } from "react";
import PoptavkaTechnikaSectionPhoto, {
  emptySectionPhotoState,
  type SectionPhotoState,
} from "@/components/portal/PoptavkaTechnikaSectionPhoto";
import {
  ODPovednosti_UPOZORNENI,
  TECHNIKA_SECTION_PHOTOS,
  VYJEZD_CENIK_LINES,
  VYJEZD_UPOZORNENI,
  type TechnickeRezim,
  type TechnikaSectionPhotoKey,
} from "@/lib/client-portal/poptavka-technika-podminky";
import {
  TECHNIK_VYJEZD_FAKTURACE_UPOZORNENI,
  TECHNIK_VYJEZD_KM_SAZBA_KC,
  TECHNIK_VYJEZD_KONECNA_CENA_UPOZORNENI,
  TECHNIK_VYJEZD_MINIMUM_KC,
  calculateTechnikVyjezdDoprava,
} from "@/lib/client-portal/technik-vyjezd-pricing";
import {
  ANO_NE_OPTIONS,
  ELEKTRO_ZDROJ_OPTIONS,
  PRIPOJKA_COUNT_FIELDS,
  SDILENA_PRIPOJKA_VAROVANI,
  STAGE_PRIPOJKA_OPTIONS,
  type PoptavkaTechnikaFormValues,
} from "@/lib/client-portal/poptavka-technika-form";
import type { PoptavkaFotkaWithUrl } from "@/lib/client-portal/poptavka-fotky-server";

type Props = {
  technika: PoptavkaTechnikaFormValues;
  onChange: (next: PoptavkaTechnikaFormValues) => void;
  uiRezim: TechnickeRezim | null;
  uiPotvrzeno: boolean;
  onUiRezimChange: (rezim: TechnickeRezim | null) => void;
  onUiPotvrzenoChange: (potvrzeno: boolean) => void;
  readOnly?: boolean;
  poptavkaId?: string;
  initialFotky?: PoptavkaFotkaWithUrl[];
  sectionPhotos: Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>>;
  onSectionPhotosChange: (
    key: TechnikaSectionPhotoKey,
    next: SectionPhotoState
  ) => void;
  inputClass: string;
  labelClass: string;
  optionCardClass: string;
  mistoLat: number | null;
  mistoLng: number | null;
  kontaktJmeno: string;
  kontaktTelefon: string;
  kontaktEmail: string;
  submitting?: boolean;
  onSubmitKlient?: () => void;
  highlightMissingPhotos?: boolean;
};

function buildInitialSectionPhotos(
  initialFotky: PoptavkaFotkaWithUrl[]
): Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>> {
  const map: Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>> = {};

  for (const section of TECHNIKA_SECTION_PHOTOS) {
    map[section.key] = {
      ...emptySectionPhotoState(),
      saved: initialFotky
        .filter((row) => row.typ === section.typ)
        .map((row) => ({
          id: row.id,
          typ: row.typ,
          popis: row.popis,
          original_filename: row.original_filename,
          signedUrl: row.signedUrl,
        })),
    };
  }

  return map;
}

export function createInitialSectionPhotos(initialFotky: PoptavkaFotkaWithUrl[] = []) {
  return buildInitialSectionPhotos(initialFotky);
}

const choiceCardClass =
  "rounded-2xl border border-white/15 bg-white/[0.03] p-5 text-left transition hover:border-amber-500/40 hover:bg-white/[0.05]";

const warningBoxClass =
  "rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-4 text-sm leading-relaxed text-amber-50";

export default function PoptavkaTechnickePodminkyStep({
  technika,
  onChange,
  uiRezim,
  uiPotvrzeno,
  onUiRezimChange,
  onUiPotvrzenoChange,
  readOnly = false,
  poptavkaId,
  initialFotky = [],
  sectionPhotos,
  onSectionPhotosChange,
  inputClass,
  labelClass,
  optionCardClass,
  mistoLat,
  mistoLng,
  kontaktJmeno,
  kontaktTelefon,
  kontaktEmail,
  submitting = false,
  onSubmitKlient,
  highlightMissingPhotos = false,
}: Props) {
  const effectiveRezim = uiRezim ?? (technika.technicke_rezim || null);
  const effectivePotvrzeno =
    uiPotvrzeno ||
    technika.technicke_potvrzeni_odpovednosti ||
    technika.technicke_potvrzeni_vyjezd_ceny;

  const sectionPhotoConfig = useMemo(
    () =>
      Object.fromEntries(
        TECHNIKA_SECTION_PHOTOS.map((section) => [section.key, section])
      ) as Record<
        TechnikaSectionPhotoKey,
        (typeof TECHNIKA_SECTION_PHOTOS)[number]
      >,
    []
  );

  function updateField<K extends keyof PoptavkaTechnikaFormValues>(
    key: K,
    value: PoptavkaTechnikaFormValues[K]
  ) {
    onChange({ ...technika, [key]: value });
  }

  function selectRezim(rezim: TechnickeRezim) {
    onUiRezimChange(rezim);
    onUiPotvrzenoChange(false);
    onChange({
      ...technika,
      technicke_rezim: rezim,
      technicke_potvrzeni_odpovednosti: false,
      technicke_potvrzeni_vyjezd_ceny: false,
      pozadovan_vyjezd_technika: rezim === "vyjezd_technika",
    });
  }

  function confirmKlientVyplni() {
    onUiPotvrzenoChange(true);
    onChange({
      ...technika,
      technicke_rezim: "klient_vyplni",
      technicke_potvrzeni_odpovednosti: true,
      technicke_potvrzeni_vyjezd_ceny: false,
      pozadovan_vyjezd_technika: false,
    });
  }

  function confirmVyjezdTechnika() {
    onUiPotvrzenoChange(true);
    onChange({
      ...technika,
      technicke_rezim: "vyjezd_technika",
      technicke_potvrzeni_odpovednosti: false,
      technicke_potvrzeni_vyjezd_ceny: true,
      pozadovan_vyjezd_technika: true,
      technik_vyjezd_kontakt_jmeno:
        technika.technik_vyjezd_kontakt_jmeno.trim() || kontaktJmeno,
      technik_vyjezd_kontakt_telefon:
        technika.technik_vyjezd_kontakt_telefon.trim() || kontaktTelefon,
      technik_vyjezd_kontakt_email:
        technika.technik_vyjezd_kontakt_email.trim() || kontaktEmail,
    });
  }

  const vyjezdKalkulace = useMemo(() => {
    if (mistoLat == null || mistoLng == null) return null;
    return calculateTechnikVyjezdDoprava(mistoLat, mistoLng);
  }, [mistoLat, mistoLng]);

  const canOrderVyjezd =
    mistoLat != null &&
    mistoLng != null &&
    technika.technik_vyjezd_potvrzeni_fakturace &&
    technika.technik_vyjezd_kontakt_jmeno.trim() &&
    technika.technik_vyjezd_kontakt_email.trim() &&
    (technika.technik_vyjezd_preferuje_telefon || technika.technik_vyjezd_preferuje_email);

  function sectionPhotoMissing(key: TechnikaSectionPhotoKey) {
    if (!highlightMissingPhotos) return false;
    const state = sectionPhotos[key] ?? emptySectionPhotoState();
    return state.pending.length === 0 && state.saved.length === 0;
  }

  function renderSectionPhoto(key: TechnikaSectionPhotoKey, missingPhoto?: boolean) {
    const config = sectionPhotoConfig[key];
    const state = sectionPhotos[key] ?? emptySectionPhotoState();
    const hasPhoto = state.pending.length > 0 || state.saved.length > 0;

    return (
      <div className={missingPhoto && !hasPhoto ? "rounded-xl ring-2 ring-red-400/70" : undefined}>
        {missingPhoto && !hasPhoto ? (
          <p className="mb-2 text-xs font-semibold text-red-300">
            Povinná fotka — nahrajte alespoň jednu fotku této sekce.
          </p>
        ) : null}
        <PoptavkaTechnikaSectionPhoto
          sectionKey={key}
          typ={config.typ}
          captureLabel={config.captureLabel}
          uploadLabel={config.uploadLabel}
          poptavkaId={poptavkaId}
          readOnly={readOnly}
          state={state}
          onPendingChange={(next) => onSectionPhotosChange(key, next)}
        />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">4. Technické podmínky</h2>
        <p className="mt-1 text-sm text-slate-400">
          Zvolte, zda technické informace k místu vyplníte sami, nebo požádáte o placený výjezd
          technika WEST COUNTY.
        </p>
      </div>

      <input type="hidden" name="technicke_rezim" value={technika.technicke_rezim} readOnly />
      {technika.technicke_potvrzeni_odpovednosti ? (
        <input type="hidden" name="technicke_potvrzeni_odpovednosti" value="on" readOnly />
      ) : null}
      {technika.technicke_potvrzeni_vyjezd_ceny ? (
        <input type="hidden" name="technicke_potvrzeni_vyjezd_ceny" value="on" readOnly />
      ) : null}

      {!effectiveRezim && !readOnly ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            className={choiceCardClass}
            onClick={() => selectRezim("klient_vyplni")}
          >
            <div className="text-base font-bold text-white">Zadám technické informace sám</div>
            <p className="mt-2 text-sm text-slate-400">
              Vyplníte elektro, příjezd, vzdálenosti a další podmínky. Nesete odpovědnost za
              správnost údajů.
            </p>
          </button>
          <button
            type="button"
            className={choiceCardClass}
            onClick={() => selectRezim("vyjezd_technika")}
          >
            <div className="text-base font-bold text-white">
              Požaduji výjezd technika pro kontrolu technických podmínek na místě
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Technik WEST COUNTY zkontroluje místo na místě. Výjezd je zpoplatněn dle ceníku.
            </p>
          </button>
        </div>
      ) : null}

      {effectiveRezim === "klient_vyplni" && !effectivePotvrzeno && !readOnly ? (
        <div className="space-y-4">
          <div className={warningBoxClass}>{ODPovednosti_UPOZORNENI}</div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirmKlientVyplni}
              className="rounded-xl border border-emerald-500/60 bg-emerald-500/20 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/30"
            >
              Potvrzuji a zadám technické informace
            </button>
            <button
              type="button"
              onClick={() => selectRezim("vyjezd_technika")}
              className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Raději požaduji výjezd technika
            </button>
          </div>
        </div>
      ) : null}

      {effectiveRezim === "vyjezd_technika" && !effectivePotvrzeno && !readOnly ? (
        <div className="space-y-4">
          <div className={warningBoxClass}>{VYJEZD_UPOZORNENI}</div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirmVyjezdTechnika}
              className="rounded-xl border border-emerald-500/60 bg-emerald-500/20 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/30"
            >
              Potvrzuji placený výjezd technika
            </button>
            <button
              type="button"
              onClick={() => selectRezim("klient_vyplni")}
              className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Raději zadám technické informace sám
            </button>
          </div>
        </div>
      ) : null}

      {readOnly && effectiveRezim ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200">
          {effectiveRezim === "klient_vyplni"
            ? "Klient vyplňuje technické informace sám."
            : "Klient požaduje placený výjezd technika."}
        </div>
      ) : null}

      {effectiveRezim === "klient_vyplni" && effectivePotvrzeno ? (
        <div className="space-y-6">
          {!readOnly ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  onUiPotvrzenoChange(false);
                  onChange({
                    ...technika,
                    technicke_potvrzeni_odpovednosti: false,
                  });
                }}
                className="text-xs text-slate-400 underline hover:text-slate-200"
              >
                Změnit volbu režimu
              </button>
              <button
                type="button"
                onClick={() => selectRezim("vyjezd_technika")}
                className="text-xs text-amber-300 underline hover:text-amber-200"
              >
                Raději požaduji výjezd technika
              </button>
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="font-semibold text-white">Elektro / rozvaděč</h3>

            <div>
              <span className={labelClass}>Typ zdroje elektřiny *</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ELEKTRO_ZDROJ_OPTIONS.map((option) => (
                  <label key={option.value} className={optionCardClass}>
                    <input
                      type="radio"
                      name="elektro_zdroj_typ"
                      value={option.value}
                      checked={technika.elektro_zdroj_typ === option.value}
                      onChange={() => updateField("elektro_zdroj_typ", option.value)}
                      disabled={readOnly}
                      required={!readOnly}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="block space-y-2">
              <span className={labelClass}>Popis rozvaděče a elektro na místě</span>
              <textarea
                name="rozvadece_poznamka"
                value={technika.rozvadece_poznamka}
                onChange={(e) => updateField("rozvadece_poznamka", e.target.value)}
                disabled={readOnly}
                rows={2}
                className={inputClass}
              />
            </label>

            <label className="block space-y-2">
              <span className={labelClass}>Hodnota hlavního chrániče větve *</span>
              <input
                name="hlavni_chranic_vetve"
                value={technika.hlavni_chranic_vetve}
                onChange={(e) => updateField("hlavni_chranic_vetve", e.target.value)}
                disabled={readOnly}
                className={inputClass}
                placeholder="Např. 30 mA, 300 mA, bez chrániče"
                required={!readOnly}
              />
            </label>

            <div className="space-y-3">
              <span className={labelClass}>Přípojky v rozvaděči — pouze 5PIN! *</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PRIPOJKA_COUNT_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      name={key}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={technika[key]}
                      onChange={(e) => updateField(key, e.target.value)}
                      disabled={readOnly}
                      className={`${inputClass} !w-20 max-w-32 shrink-0 px-3`}
                      required={!readOnly}
                    />
                    <span className="whitespace-nowrap text-sm font-medium text-slate-200">
                      × {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className={labelClass}>Přípojka pro stage techniku *</span>
              <div className="mt-2 space-y-2">
                {STAGE_PRIPOJKA_OPTIONS.map((option) => (
                  <label key={option.value} className={optionCardClass}>
                    <input
                      type="radio"
                      name="stage_pripojka_rezim"
                      value={option.value}
                      checked={technika.stage_pripojka_rezim === option.value}
                      onChange={() => updateField("stage_pripojka_rezim", option.value)}
                      disabled={readOnly}
                      required={!readOnly}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {technika.stage_pripojka_rezim === "sdilena_s_dalsimi_odbery" ? (
              <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {SDILENA_PRIPOJKA_VAROVANI}
              </div>
            ) : null}

            <label className="block space-y-2">
              <span className={labelClass}>Vzdálenost od přípojky k síti / centrály (m)</span>
              <input
                name="elektro_vzdalenost_m"
                inputMode="decimal"
                value={technika.elektro_vzdalenost_m}
                onChange={(e) => updateField("elektro_vzdalenost_m", e.target.value)}
                disabled={readOnly}
                className={inputClass}
                placeholder="Metry od zdroje k místu stage techniky"
              />
            </label>

            {renderSectionPhoto("rozvadec", sectionPhotoMissing("rozvadec"))}
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="font-semibold text-white">Příjezd na místo</h3>
            <label className="block space-y-2">
              <span className={labelClass}>Poznámka k příjezdu</span>
              <textarea
                name="prijezd_poznamka"
                value={technika.prijezd_poznamka}
                onChange={(e) => updateField("prijezd_poznamka", e.target.value)}
                disabled={readOnly}
                rows={2}
                className={inputClass}
                placeholder="Vjezd, brána, omezení pro dodávku…"
              />
            </label>
            <div>
              <span className={labelClass}>Je možný příjezd až k místu stavby stage? *</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ANO_NE_OPTIONS.map(([value, label]) => (
                  <label key={value} className={optionCardClass}>
                    <input
                      type="radio"
                      name="prijezd_az_ke_stage"
                      value={value}
                      checked={technika.prijezd_az_ke_stage === value}
                      onChange={() => {
                        onChange({
                          ...technika,
                          prijezd_az_ke_stage: value,
                          prijezd_dodavka_35t: value === "ano" ? technika.prijezd_dodavka_35t : false,
                          prijezd_nakladni_12t: value === "ano" ? technika.prijezd_nakladni_12t : false,
                          prijezd_vzdalenost_od_stage_m:
                            value === "ne" ? technika.prijezd_vzdalenost_od_stage_m : "",
                        });
                      }}
                      disabled={readOnly}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            {technika.prijezd_az_ke_stage === "ano" ? (
              <div>
                <span className={labelClass}>Která vozidla projedou až ke stage? *</span>
                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      name="prijezd_dodavka_35t"
                      checked={technika.prijezd_dodavka_35t}
                      onChange={(e) => updateField("prijezd_dodavka_35t", e.target.checked)}
                      disabled={readOnly}
                    />
                    Dodávka do 3,5 t
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      name="prijezd_nakladni_12t"
                      checked={technika.prijezd_nakladni_12t}
                      onChange={(e) => updateField("prijezd_nakladni_12t", e.target.checked)}
                      disabled={readOnly}
                    />
                    Nákladní vozidlo 12 t
                  </label>
                </div>
              </div>
            ) : null}
            {technika.prijezd_az_ke_stage === "ne" ? (
              <label className="block space-y-2">
                <span className={labelClass}>
                  Vzdálenost možného příjezdu od místa stavby stage *
                </span>
                <div className="flex items-center gap-2">
                  <input
                    name="prijezd_vzdalenost_od_stage_m"
                    inputMode="decimal"
                    value={technika.prijezd_vzdalenost_od_stage_m}
                    onChange={(e) => updateField("prijezd_vzdalenost_od_stage_m", e.target.value)}
                    disabled={readOnly}
                    className={`${inputClass} max-w-[10rem]`}
                    placeholder="0"
                  />
                  <span className="text-sm text-slate-400">m</span>
                </div>
              </label>
            ) : null}
            {renderSectionPhoto("prijezd", sectionPhotoMissing("prijezd"))}
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="font-semibold text-white">Vzdálenost od vykládky ke stage</h3>
            <label className="block space-y-2">
              <span className={labelClass}>Vzdálenost / popis trasy</span>
              <input
                name="vzdalenost_vykladka_stage"
                value={technika.vzdalenost_vykladka_stage}
                onChange={(e) => updateField("vzdalenost_vykladka_stage", e.target.value)}
                disabled={readOnly}
                className={inputClass}
                placeholder="Např. 45 m po zpevněné ploše"
              />
            </label>
            {renderSectionPhoto("plocha_stage", sectionPhotoMissing("plocha_stage"))}
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="font-semibold text-white">Povrch a přístup pro techniku</h3>
            <div>
              <span className={labelClass}>Je místo zpevněné?</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ANO_NE_OPTIONS.map(([value, label]) => (
                  <label key={value} className={optionCardClass}>
                    <input
                      type="radio"
                      name="misto_zpevnene"
                      value={value}
                      checked={technika.misto_zpevnene === value}
                      onChange={() => updateField("misto_zpevnene", value)}
                      disabled={readOnly}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="block space-y-2">
              <span className={labelClass}>Přístup pro techniku / místo realizace</span>
              <textarea
                name="pristup_pro_techniku"
                value={technika.pristup_pro_techniku}
                onChange={(e) => updateField("pristup_pro_techniku", e.target.value)}
                disabled={readOnly}
                rows={2}
                className={inputClass}
              />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Místo pro stage</span>
              <textarea
                name="misto_stage"
                value={technika.misto_stage}
                onChange={(e) => updateField("misto_stage", e.target.value)}
                disabled={readOnly}
                rows={2}
                className={inputClass}
              />
            </label>
            {renderSectionPhoto("povrch_pristup", sectionPhotoMissing("povrch_pristup"))}
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="font-semibold text-white">Omezení průjezdu / výšky / šířky</h3>
            <label className="block space-y-2">
              <span className={labelClass}>Popis omezení</span>
              <textarea
                name="omezeni_prujezdu"
                value={technika.omezeni_prujezdu}
                onChange={(e) => updateField("omezeni_prujezdu", e.target.value)}
                disabled={readOnly}
                rows={2}
                className={inputClass}
              />
            </label>
            <div>
              <span className={labelClass}>Kabel přes silnici / veřejný průchod?</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ANO_NE_OPTIONS.map(([value, label]) => (
                  <label key={value} className={optionCardClass}>
                    <input
                      type="radio"
                      name="kabel_pres_silnici"
                      value={value}
                      checked={technika.kabel_pres_silnici === value}
                      onChange={() => updateField("kabel_pres_silnici", value)}
                      disabled={readOnly}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="block space-y-2">
              <span className={labelClass}>Kabelové trasy</span>
              <textarea
                name="kabelove_trasy"
                value={technika.kabelove_trasy}
                onChange={(e) => updateField("kabelove_trasy", e.target.value)}
                disabled={readOnly}
                rows={2}
                className={inputClass}
              />
            </label>
            {renderSectionPhoto("jina", sectionPhotoMissing("jina"))}
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="font-semibold text-white">Parkování techniky</h3>
            <label className="block space-y-2">
              <span className={labelClass}>Možnost parkování</span>
              <textarea
                name="parkovani_poznamka"
                value={technika.parkovani_poznamka}
                onChange={(e) => updateField("parkovani_poznamka", e.target.value)}
                disabled={readOnly}
                rows={2}
                className={inputClass}
              />
            </label>
            {renderSectionPhoto("misto_akce", sectionPhotoMissing("misto_akce"))}
          </div>

          <label className="block space-y-2">
            <span className={labelClass}>Poznámka</span>
            <textarea
              name="dalsi_poznamky"
              value={technika.dalsi_poznamky}
              onChange={(e) => updateField("dalsi_poznamky", e.target.value)}
              disabled={readOnly}
              rows={3}
              className={inputClass}
            />
          </label>

          {!readOnly && onSubmitKlient ? (
            <button
              type="button"
              disabled={submitting}
              onClick={onSubmitKlient}
              className="w-full rounded-xl border border-blue-500/60 bg-blue-500/20 px-5 py-4 text-sm font-bold text-blue-50 transition hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting ? "Odesílám…" : "Odeslat poptávku"}
            </button>
          ) : null}
        </div>
      ) : null}

      {effectiveRezim === "vyjezd_technika" && effectivePotvrzeno ? (
        <div className="space-y-5">
          {!readOnly ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  onUiPotvrzenoChange(false);
                  onChange({
                    ...technika,
                    technicke_potvrzeni_vyjezd_ceny: false,
                  });
                }}
                className="text-xs text-slate-400 underline hover:text-slate-200"
              >
                Změnit volbu režimu
              </button>
              <button
                type="button"
                onClick={() => selectRezim("klient_vyplni")}
                className="text-xs text-amber-300 underline hover:text-amber-200"
              >
                Raději zadám technické informace sám
              </button>
            </div>
          ) : null}

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50">
            <p className="font-semibold">Podmínky výjezdu technika</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-emerald-100/90">
              {VYJEZD_CENIK_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-3 font-medium text-emerald-100">
              Minimální cena výjezdu: {TECHNIK_VYJEZD_MINIMUM_KC.toLocaleString("cs-CZ")} Kč
            </p>
          </div>

          {mistoLat == null || mistoLng == null ? (
            <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-4 text-sm text-red-100">
              Pro objednání výjezdu technika nejdřív doplňte přesné místo akce v kroku „Kde a
              kdy“ — vyberte GPS bod na mapě a vyplňte přesný popis místa.
            </div>
          ) : vyjezdKalkulace ? (
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-slate-200">
              <p>
                Orientační vzdálenost z centrály na místo akce a zpět:{" "}
                <span className="font-semibold text-white">
                  {vyjezdKalkulace.roundTripKm.toLocaleString("cs-CZ")} km
                </span>
              </p>
              <p>
                Orientační doprava: {vyjezdKalkulace.roundTripKm.toLocaleString("cs-CZ")} ×{" "}
                {TECHNIK_VYJEZD_KM_SAZBA_KC} Kč ={" "}
                <span className="font-semibold text-white">
                  {vyjezdKalkulace.dopravaKc.toLocaleString("cs-CZ")} Kč
                </span>
              </p>
              <p className="text-xs text-slate-400">
                Výpočet je orientační (vzdušná vzdálenost upravená koeficientem).{" "}
                {TECHNIK_VYJEZD_KONECNA_CENA_UPOZORNENI}
              </p>
            </div>
          ) : null}

          {!readOnly ? (
            <>
              <div className={warningBoxClass}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    name="technik_vyjezd_potvrzeni_fakturace"
                    checked={technika.technik_vyjezd_potvrzeni_fakturace}
                    onChange={(e) =>
                      updateField("technik_vyjezd_potvrzeni_fakturace", e.target.checked)
                    }
                    className="mt-1"
                    required
                  />
                  <span>{TECHNIK_VYJEZD_FAKTURACE_UPOZORNENI}</span>
                </label>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="font-semibold text-white">Kontakt pro výjezd technika</h3>
                <p className="text-sm text-slate-400">
                  Údaje z kroku „Kdo zadává“ — můžete je upravit pro domluvu výjezdu.
                </p>
                <label className="block space-y-2">
                  <span className={labelClass}>Kontaktní osoba *</span>
                  <input
                    name="technik_vyjezd_kontakt_jmeno"
                    value={technika.technik_vyjezd_kontakt_jmeno}
                    onChange={(e) => updateField("technik_vyjezd_kontakt_jmeno", e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className={labelClass}>Telefon</span>
                    <input
                      name="technik_vyjezd_kontakt_telefon"
                      value={technika.technik_vyjezd_kontakt_telefon}
                      onChange={(e) =>
                        updateField("technik_vyjezd_kontakt_telefon", e.target.value)
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className={labelClass}>E-mail *</span>
                    <input
                      name="technik_vyjezd_kontakt_email"
                      type="email"
                      value={technika.technik_vyjezd_kontakt_email}
                      onChange={(e) => updateField("technik_vyjezd_kontakt_email", e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                </div>
                <div>
                  <span className={labelClass}>Preferovaný způsob kontaktu *</span>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        name="technik_vyjezd_preferuje_telefon"
                        checked={technika.technik_vyjezd_preferuje_telefon}
                        onChange={(e) =>
                          updateField("technik_vyjezd_preferuje_telefon", e.target.checked)
                        }
                      />
                      Telefon
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        name="technik_vyjezd_preferuje_email"
                        checked={technika.technik_vyjezd_preferuje_email}
                        onChange={(e) =>
                          updateField("technik_vyjezd_preferuje_email", e.target.checked)
                        }
                      />
                      E-mail
                    </label>
                  </div>
                </div>
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>Volitelná poznámka k výjezdu technika</span>
                <textarea
                  name="dalsi_poznamky"
                  value={technika.dalsi_poznamky}
                  onChange={(e) => updateField("dalsi_poznamky", e.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="Preferovaný termín obhlídky, kontakt na místě…"
                />
              </label>

              <button
                type="submit"
                name="save_intent"
                value="order_technik_vyjezd"
                disabled={submitting || !canOrderVyjezd}
                className="w-full rounded-xl border border-emerald-500/60 bg-emerald-500/20 px-5 py-4 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {submitting
                  ? "Odesílám…"
                  : "Odeslat poptávku a závazně objednat výjezd technika"}
              </button>
            </>
          ) : (
            <label className="block space-y-2">
              <span className={labelClass}>Poznámka k výjezdu technika</span>
              <textarea
                name="dalsi_poznamky"
                value={technika.dalsi_poznamky}
                disabled
                rows={3}
                className={inputClass}
              />
            </label>
          )}
        </div>
      ) : null}
    </section>
  );
}
