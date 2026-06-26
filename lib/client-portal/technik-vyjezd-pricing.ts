import { calculateRoundTripFromHqKm } from "@/lib/geo/route-distance-km";
import { WEST_COUNTY_HQ } from "@/lib/locations/west-county-hq";

export const TECHNIK_VYJEZD_HODINOVA_SAZBA_KC = 500;
export const TECHNIK_VYJEZD_KM_SAZBA_KC = 7;
export const TECHNIK_VYJEZD_MINIMUM_KC = 3000;

export const TECHNIK_VYJEZD_FAKTURACE_UPOZORNENI =
  "Beru na vědomí, že výjezd technika WEST COUNTY je zpoplatněn a bude fakturován i v případě, že akce nebude následně realizována.";

export const TECHNIK_VYJEZD_KONECNA_CENA_UPOZORNENI =
  "Konečná cena výjezdu bude potvrzena pracovníkem WEST COUNTY podle reálné trasy, času na místě a domluveného termínu.";

export function calculateTechnikVyjezdDoprava(eventLat: number, eventLng: number) {
  const route = calculateRoundTripFromHqKm(eventLat, eventLng);
  const dopravaKc = Math.round(route.roundTripKm * TECHNIK_VYJEZD_KM_SAZBA_KC);

  return {
    hqName: WEST_COUNTY_HQ.name,
    ...route,
    dopravaKc,
    kmSazba: TECHNIK_VYJEZD_KM_SAZBA_KC,
  };
}
