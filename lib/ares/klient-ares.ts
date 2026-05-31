export type AresSidlo = {
  nazevUlice?: unknown;
  cisloDomovni?: unknown;
  cisloOrientacni?: unknown;
  nazevObce?: unknown;
  nazevCastiObce?: unknown;
  textovaAdresa?: unknown;
  psc?: unknown;
};

export type AresSubject = {
  ico?: unknown;
  obchodniJmeno?: unknown;
  dic?: unknown;
  sidlo?: AresSidlo;
};

export type KlientAresFormData = {
  nazev: string;
  ulice: string;
  mesto: string;
  psc: string;
  ico: string;
  dic: string;
};

function getString(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function formatAddressNumber(address?: AresSidlo) {
  const houseNumber = getString(address?.cisloDomovni);
  const orientationNumber = getString(address?.cisloOrientacni);
  return [houseNumber, orientationNumber].filter(Boolean).join("/");
}

function getStreetFromTextAddress(address?: AresSidlo) {
  const textAddress = getString(address?.textovaAdresa);
  if (!textAddress) return "";

  const firstPart = textAddress.split(",")[0]?.trim() ?? "";
  return /\d/.test(firstPart) ? firstPart : "";
}

export function formatStreetFromAresSidlo(address?: AresSidlo) {
  const streetName =
    getString(address?.nazevUlice) || getString(address?.nazevCastiObce);
  const numberPart = formatAddressNumber(address);

  if (!streetName) {
    return getStreetFromTextAddress(address);
  }

  return [streetName, numberPart].filter(Boolean).join(" ");
}

export function normalizeIco(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePsc(value: unknown) {
  return getString(value).replace(/\s+/g, "");
}

export function mapAresSubjectToKlientForm(subject: AresSubject, ico: string): KlientAresFormData {
  const street = formatStreetFromAresSidlo(subject.sidlo);
  const city =
    getString(subject.sidlo?.nazevObce) || getString(subject.sidlo?.nazevCastiObce);
  const psc = normalizePsc(subject.sidlo?.psc);

  return {
    nazev: getString(subject.obchodniJmeno),
    ico: getString(subject.ico) || ico,
    dic: getString(subject.dic),
    ulice: street,
    mesto: city,
    psc,
  };
}

export type FetchKlientFromAresResult =
  | { ok: true; subject: AresSubject; form: KlientAresFormData }
  | { ok: false; error: "invalid_ico" | "not_found" | "unavailable" };

export async function fetchKlientFromAres(icoInput: string): Promise<FetchKlientFromAresResult> {
  const ico = normalizeIco(icoInput);
  if (!/^\d{8}$/.test(ico)) {
    return { ok: false, error: "invalid_ico" };
  }

  try {
    const response = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
      { headers: { Accept: "application/json" } }
    );

    if (response.status === 404) {
      return { ok: false, error: "not_found" };
    }

    if (!response.ok) {
      return { ok: false, error: "unavailable" };
    }

    const subject = (await response.json()) as AresSubject;
    return {
      ok: true,
      subject,
      form: mapAresSubjectToKlientForm(subject, ico),
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
