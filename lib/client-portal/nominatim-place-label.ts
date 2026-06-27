type NominatimAddress = {
  amenity?: string;
  building?: string;
  road?: string;
  house_number?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
  country?: string;
};

type NominatimReverseResult = {
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
};

function joinParts(parts: Array<string | undefined | null>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function buildPlaceLabelFromNominatim(data: NominatimReverseResult): string | null {
  const address = data.address;
  if (address) {
    const name = data.name || address.amenity || address.building;
    const locality = address.city || address.town || address.village || address.municipality;
    const street = joinParts([address.road, address.house_number]);
    const composed = joinParts([name, street, locality]);
    if (composed) return composed;
  }

  const display = data.display_name?.trim();
  if (display) return display;

  return null;
}

export async function reverseGeocodePlaceLabel(lat: number, lng: number): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    addressdetails: "1",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": "cs",
      },
    }
  );

  if (!response.ok) return null;

  const data = (await response.json()) as NominatimReverseResult;
  return buildPlaceLabelFromNominatim(data);
}

export function formatCoordsFallbackLabel(lat: number, lng: number) {
  return `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
