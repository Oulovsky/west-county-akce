import { WEST_COUNTY_HQ } from "@/lib/locations/west-county-hq";

export type RouteDistanceVypocetTyp = "google_directions" | "orientacni_vzdusna_cara";

export type RouteDistanceResult = {
  oneWayKm: number;
  roundTripKm: number;
  vypocetTyp: RouteDistanceVypocetTyp;
  /** Popisek pro UI — zda jde o orientační výpočet. */
  isOrientacni: boolean;
};

/** Vzdálenost vzdušnou čarou mezi dvěma body (Haversine), v km. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

/**
 * Vzdálenost z centrály WEST COUNTY na místo akce a zpět.
 *
 * TODO: Napojit Google Maps Directions API pro jízdní vzdálenost po trase.
 * Zatím orientační výpočet vzdušnou čarou × koeficient 1,25 (aproximace silnice).
 */
export function calculateRoundTripFromHqKm(
  eventLat: number,
  eventLng: number
): RouteDistanceResult {
  const airKm = haversineDistanceKm(WEST_COUNTY_HQ.lat, WEST_COUNTY_HQ.lng, eventLat, eventLng);
  const roadFactor = 1.25;
  const oneWayKm = Math.round(airKm * roadFactor * 10) / 10;
  const roundTripKm = Math.round(oneWayKm * 2 * 10) / 10;

  return {
    oneWayKm,
    roundTripKm,
    vypocetTyp: "orientacni_vzdusna_cara",
    isOrientacni: true,
  };
}

export function isValidGpsCoordinate(lat: number | null, lng: number | null): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
