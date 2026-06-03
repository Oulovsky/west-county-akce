export type SpravaObsahReturnTo = "sprava" | "polozka";

export function buildSpravaPolozkaHref(returnPolozkaId: string): string {
  const search = new URLSearchParams();
  search.set("obsahPolozka", returnPolozkaId);
  return `/sklad/sprava?${search.toString()}`;
}

export function buildSpravaObsahHref(
  returnPolozkaId: string,
  parentKusId: string,
  opts?: { insert?: boolean }
): string {
  const search = new URLSearchParams();
  search.set("obsahPolozka", returnPolozkaId);
  search.set("obsahCase", parentKusId);
  if (opts?.insert) {
    search.set("obsahMode", "insert");
  }
  return `/sklad/sprava?${search.toString()}`;
}

export function buildPolozkaObsahHref(
  returnPolozkaId: string,
  parentKusId: string,
  opts?: { insert?: boolean }
): string {
  const search = new URLSearchParams();
  search.set("obsahCase", parentKusId);
  if (opts?.insert) {
    search.set("obsahMode", "insert");
  }
  const query = search.toString();
  return `/sklad/${returnPolozkaId}${query ? `?${query}` : ""}`;
}
