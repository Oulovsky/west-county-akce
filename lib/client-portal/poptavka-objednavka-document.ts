import type {
  FotkaDraft,
  PoptavkaObjednavkaDocumentData,
  PoptavkaObjednavkaDocumentFotka,
  PoptavkaObjednavkaDraftData,
  PoptavkaObjednavkaSnapshot,
  TerminBlock,
} from "@/lib/client-portal/poptavka-objednavka-types";

function mapDraftFotky(
  fotky: FotkaDraft[],
  imageUrls?: Record<string, string | null | undefined>
): PoptavkaObjednavkaDocumentFotka[] {
  return fotky
    .filter((row) => row.zahrnoutDoObjednavky)
    .map((row) => ({
      fotkaId: row.fotkaId,
      typ: row.typ,
      popis: row.popis,
      imageUrl: imageUrls?.[row.fotkaId] ?? null,
      poradi: row.poradi,
    }))
    .sort((a, b) => a.poradi - b.poradi);
}

export function draftDataToDocumentData(
  draft: PoptavkaObjednavkaDraftData,
  imageUrls?: Record<string, string | null | undefined>
): PoptavkaObjednavkaDocumentData {
  return {
    klient: draft.klient,
    dodavatel: draft.dodavatel,
    akce: draft.akce,
    misto: draft.misto,
    organizace: draft.organizace,
    technickePlneni: draft.technickePlneni,
    smluvniPodminky: draft.smluvniPodminky,
    textProKlienta: draft.textProKlienta,
    fotky: mapDraftFotky(draft.fotky, imageUrls),
  };
}

export function snapshotToDocumentData(
  snapshot: PoptavkaObjednavkaSnapshot
): PoptavkaObjednavkaDocumentData {
  return {
    klient: snapshot.klient,
    dodavatel: snapshot.dodavatel,
    akce: snapshot.akce,
    misto: snapshot.misto,
    organizace: snapshot.organizace,
    technickePlneni: snapshot.technickePlneni,
    smluvniPodminky: snapshot.smluvniPodminky,
    textProKlienta: snapshot.textProKlienta,
    fotky: snapshot.fotky
      .map((row) => ({
        fotkaId: row.fotkaId,
        typ: row.typ,
        popis: row.popis,
        imageUrl: row.publicUrl,
        poradi: row.poradi,
      }))
      .sort((a, b) => a.poradi - b.poradi),
  };
}

export function formatObjednavkaDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatObjednavkaTime(value: string | null | undefined) {
  if (!value?.trim()) return null;
  return value.slice(0, 5);
}

export function formatObjednavkaDateRange(od: string | null, doValue: string | null) {
  const from = formatObjednavkaDate(od);
  const to = formatObjednavkaDate(doValue);
  if (!from && !to) return null;
  if (from === to || !to) return from;
  return `${from} – ${to}`;
}

export function formatObjednavkaTermin(termin: TerminBlock) {
  const parts = [
    formatObjednavkaDate(termin.datum),
    termin.casOd && termin.casDo
      ? `${formatObjednavkaTime(termin.casOd)} – ${formatObjednavkaTime(termin.casDo)}`
      : formatObjednavkaTime(termin.casOd) ?? formatObjednavkaTime(termin.casDo),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function formatObjednavkaTriVolba(value: string | null | undefined) {
  if (value === "ano") return "Ano";
  if (value === "ne") return "Ne";
  if (value === "nevim") return "Nevím";
  return null;
}

export function formatObjednavkaGps(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  return `${lat}, ${lng}`;
}
