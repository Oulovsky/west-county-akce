/** Společný výpočet slevy — stejný princip jako u zakázek / faktur. */
export function calculateDiscountPercent(beforeDiscount: number, finalPrice: number): number {
  if (beforeDiscount <= 0) return 0;
  const discount = ((beforeDiscount - finalPrice) / beforeDiscount) * 100;
  return Number(Math.max(discount, 0).toFixed(1));
}

export function formatDiscountPercent(value: number): string {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

export function applyDiscountFromTargetPrice(
  vypoctovaCena: number,
  pozadovanaCena: number
): { ok: true; slevaProcent: number; konecnaCena: number } | { ok: false; reason: string } {
  if (vypoctovaCena <= 0) {
    return { ok: false, reason: "Nelze počítat slevu z nulové výpočtové ceny." };
  }
  if (pozadovanaCena > vypoctovaCena) {
    return { ok: false, reason: "Požadovaná cena je vyšší než výpočtová cena." };
  }
  if (pozadovanaCena < 0) {
    return { ok: false, reason: "Požadovaná cena musí být nezáporná." };
  }
  return {
    ok: true,
    slevaProcent: calculateDiscountPercent(vypoctovaCena, pozadovanaCena),
    konecnaCena: pozadovanaCena,
  };
}
