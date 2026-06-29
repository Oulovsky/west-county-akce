export type PortalHistoryPlaceHint = {
  misto_id: string | null;
};

export type PortalHistoryWithPlaceHint<T extends PortalHistoryPlaceHint> = T & {
  used_on_this_place: boolean;
};

/** Seřadí historické položky — stejné místo nahoře, bez skrytí ostatních. */
export function sortPortalHistoryByCurrentMisto<T extends PortalHistoryPlaceHint>(
  options: T[],
  currentMistoId: string | null | undefined
): PortalHistoryWithPlaceHint<T>[] {
  const normalizedMistoId = currentMistoId?.trim() || null;

  return options
    .map((option) => ({
      ...option,
      used_on_this_place: Boolean(
        normalizedMistoId && option.misto_id && option.misto_id === normalizedMistoId
      ),
    }))
    .sort((a, b) => {
      if (a.used_on_this_place && !b.used_on_this_place) return -1;
      if (!a.used_on_this_place && b.used_on_this_place) return 1;
      return 0;
    });
}
