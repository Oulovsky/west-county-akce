import { DEFAULT_PORTAL_SESTAVA_KATALOG } from "@/lib/client-portal/sestava-konfigurator-katalog";
import {
  formatSestavaSummaryText,
  normalizeSestavaStateForSave,
} from "@/lib/client-portal/sestava-konfigurator-form";
import type { PortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-types";
import type { PoptavkaObjednavkaDraftData, PoptavkaObjednavkaTriVolba } from "@/lib/client-portal/poptavka-objednavka-types";
import type { SestavaKonfiguratorState } from "@/lib/client-portal/sestava-konfigurator-types";

function parseTriFromAnoNe(value: string): PoptavkaObjednavkaTriVolba | null {
  if (value === "ano" || value === "ne") return value;
  return null;
}

function toOptionalNumber(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function kotveniTextFromSestava(sestava: SestavaKonfiguratorState): string | null {
  const typ =
    sestava.kotveni_typ === "ibc_boxy"
      ? "Zátěž IBC boxy (pořadatel zajistí vodu)"
      : sestava.kotveni_typ === "zatloukane"
        ? "Zatloukané kotvení"
        : null;
  const parts = [typ, sestava.kotveni_povrch || null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Odvozené bloky misto / technickePlneni pro snapshot a dokument z editovatelných polí. */
export function syncPoptavkaObjednavkaDraftDerived(
  draft: PoptavkaObjednavkaDraftData,
  options: { katalog?: PortalSestavaKatalog } = {}
): PoptavkaObjednavkaDraftData {
  const katalog = options.katalog ?? DEFAULT_PORTAL_SESTAVA_KATALOG;
  const sestava = normalizeSestavaStateForSave(draft.sestava);
  const technika = draft.technika;
  const sestavaSummary = formatSestavaSummaryText(sestava, katalog);

  draft.sestava = sestava;
  draft.misto = {
    ...draft.misto,
    prijezdPopis: technika.prijezd_poznamka.trim() || draft.misto.prijezdPopis,
    pristupovaCesta:
      [technika.prijezd_poznamka, technika.parkovani_poznamka]
        .map((v) => v.trim())
        .filter(Boolean)
        .join("\n") || draft.misto.pristupovaCesta,
    povrchTeren: parseTriFromAnoNe(technika.misto_zpevnene) ?? draft.misto.povrchTeren,
    vjezdTechnikou:
      parseTriFromAnoNe(technika.prijezd_az_ke_stage || technika.lze_zajet_autem) ??
      draft.misto.vjezdTechnikou,
    mistoStage: technika.misto_stage.trim() || draft.misto.mistoStage,
    mistoFoh: technika.misto_foh.trim() || draft.misto.mistoFoh,
    elektro: {
      pripojka: technika.elektro_pripojka.trim() || draft.misto.elektro.pripojka,
      jisteni:
        technika.hlavni_chranic_vetve.trim() ||
        technika.elektro_jisteni.trim() ||
        draft.misto.elektro.jisteni,
      zasuvka: technika.elektro_zasuvka.trim() || draft.misto.elektro.zasuvka,
      vzdalenostM: toOptionalNumber(technika.elektro_vzdalenost_m) ?? draft.misto.elektro.vzdalenostM,
      rozvadecePoznamka: technika.rozvadece_poznamka.trim() || draft.misto.elektro.rozvadecePoznamka,
      kabeloveTrasy: technika.kabelove_trasy.trim() || draft.misto.elektro.kabeloveTrasy,
      kabelPresSilnici:
        parseTriFromAnoNe(technika.kabel_pres_silnici) ?? draft.misto.elektro.kabelPresSilnici,
      potrebaElektrocentraly:
        technika.elektro_zdroj_typ === "elektrocentrala"
          ? "ano"
          : technika.elektro_zdroj_typ === "pevna_pripojka"
            ? "ne"
            : draft.misto.elektro.potrebaElektrocentraly,
      vzdalenostRozvadece: technika.rozvadece_poznamka.trim() || draft.misto.elektro.vzdalenostRozvadece,
    },
    omezeniHluku: technika.omezeni_hluku.trim() || draft.misto.omezeniHluku,
    casovaOmezeni: technika.casova_omezeni.trim() || draft.misto.casovaOmezeni,
    kotveniZaveseni: kotveniTextFromSestava(sestava) ?? draft.misto.kotveniZaveseni,
    pozadavkyPoradatele: technika.dalsi_poznamky.trim() || draft.misto.pozadavkyPoradatele,
    dalsiTechnickePoznamky: sestavaSummary || draft.misto.dalsiTechnickePoznamky,
    pozadovanVyjezdTechnika:
      technika.technicke_rezim === "vyjezd_technika" || technika.pozadovan_vyjezd_technika,
  };

  draft.technickePlneni = {
    ...draft.technickePlneni,
    poznamkaKTechnice: sestavaSummary || draft.technickePlneni.poznamkaKTechnice,
  };

  return draft;
}
