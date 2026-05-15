/**
 * Kritéria „aktivní / nearchivní“ zakázky pro plánovanou techniku ve skladu.
 * Zarovnáno s přehledem zakázek: záložka „Zakázky“ = nezrušená a ještě neukončená
 * (`scopedZakazky`, scope "zakazky" v app/zakazky/ZakazkyListClient.tsx).
 */

export type ZakazkaRezervaceProSklad = {
  datum_od: string;
  datum_do: string;
  cas_od: string | null;
  cas_do: string | null;
  zrusena?: boolean | null;
};

function normalizeTime(value: string | null | undefined, fallback: string) {
  if (!value || value.trim() === "") return fallback;
  return value.length === 5 ? `${value}:00` : value;
}

function toDateTime(datum: string, cas: string) {
  return new Date(`${datum}T${cas}`);
}

export function zakazkaGetStart(z: ZakazkaRezervaceProSklad) {
  return toDateTime(z.datum_od, normalizeTime(z.cas_od, "00:00:00"));
}

export function zakazkaGetEnd(z: ZakazkaRezervaceProSklad) {
  return toDateTime(z.datum_do, normalizeTime(z.cas_do, "23:59:59"));
}

function jeMinula(zakazka: ZakazkaRezervaceProSklad, ted: Date) {
  const doDatum = zakazkaGetEnd(zakazka);
  return doDatum < ted;
}

function jeZrusena(zakazka: ZakazkaRezervaceProSklad) {
  return Boolean(zakazka.zrusena);
}

export function zakazkaPocitaSeDoSkladovychRezervaci(
  z: ZakazkaRezervaceProSklad | null | undefined,
  ted: Date
): boolean {
  if (!z) return false;
  if (jeZrusena(z)) return false;
  return !jeMinula(z, ted);
}
