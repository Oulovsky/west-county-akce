import { SKLAD_TABLE } from "@/lib/sklad/constants";

export type TechnikaAvailabilityItem = {
  skladova_polozka_id: string;
  nazev: string | null;
  totalPieces: number;
  usablePieces: number;
  damagedPieces: number;
  blockedPieces: number;
  repairPieces: number;
  pendingCheckPieces: number;
  retiredPieces: number;
  plannedOnOtherOverlappingZakazky: number;
  physicallyLoadedOnOtherZakazky: number;
  reservePiecesOnOtherZakazky: number;
  requestedQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  hasCollision: boolean;
};

export type TechnikaAvailabilityResult = {
  from: string | null;
  to: string | null;
  zakazkaId?: string | null;
  items: TechnikaAvailabilityItem[];
};

type AvailabilityInput = {
  supabase: any;
  zakazkaId?: string | null;
  from?: string | null;
  to?: string | null;
  items?: Array<{ skladova_polozka_id: string; requestedQuantity?: number | string | null }>;
};

type ZakazkaRangeRow = {
  zakazka_id: string;
  nazev?: string | null;
  datum_od: string | null;
  datum_do: string | null;
  cas_od?: string | null;
  cas_do?: string | null;
  akce_od?: string | null;
  akce_do?: string | null;
  workflow_stav?: string | null;
  zrusena?: boolean | null;
};

function toNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeTime(value: string | null | undefined, fallback: string) {
  if (!value || value.trim() === "") return fallback;
  return value.length === 5 ? `${value}:00` : value;
}

function getZakazkaStart(row: ZakazkaRangeRow) {
  if (row.akce_od) return row.akce_od;
  if (!row.datum_od) return null;
  return `${row.datum_od}T${normalizeTime(row.cas_od, "00:00:00")}`;
}

function getZakazkaEnd(row: ZakazkaRangeRow) {
  if (row.akce_do) return row.akce_do;
  if (!row.datum_do) return null;
  return `${row.datum_do}T${normalizeTime(row.cas_do, "23:59:59")}`;
}

function overlaps(from: string | null, to: string | null, otherFrom: string | null, otherTo: string | null) {
  if (!from || !to || !otherFrom || !otherTo) return false;
  const aStart = new Date(from).getTime();
  const aEnd = new Date(to).getTime();
  const bStart = new Date(otherFrom).getTime();
  const bEnd = new Date(otherTo).getTime();
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false;
  return aStart <= bEnd && aEnd >= bStart;
}

function shouldIgnoreZakazka(row: ZakazkaRangeRow, rangeFrom: string | null) {
  if (row.zrusena) return true;
  if (row.workflow_stav === "zruseno" || row.workflow_stav === "archiv") return true;

  const end = getZakazkaEnd(row);
  if (end && rangeFrom) {
    const endTime = new Date(end).getTime();
    const rangeTime = new Date(rangeFrom).getTime();
    if (Number.isFinite(endTime) && Number.isFinite(rangeTime) && endTime < rangeTime) {
      return true;
    }
  }

  return false;
}

function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const result = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

export async function getTechnikaAvailability({
  supabase,
  zakazkaId,
  from,
  to,
  items,
}: AvailabilityInput): Promise<TechnikaAvailabilityResult> {
  let rangeFrom = from ?? null;
  let rangeTo = to ?? null;

  if ((!rangeFrom || !rangeTo) && zakazkaId) {
    const { data: zakazka, error } = await supabase
      .from(SKLAD_TABLE.zakazky)
      .select("zakazka_id, datum_od, datum_do, cas_od, cas_do, akce_od, akce_do")
      .eq("zakazka_id", zakazkaId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (zakazka) {
      rangeFrom = rangeFrom ?? getZakazkaStart(zakazka as ZakazkaRangeRow);
      rangeTo = rangeTo ?? getZakazkaEnd(zakazka as ZakazkaRangeRow);
    }
  }

  let requestedByItem = new Map<string, number>();
  if (items?.length) {
    requestedByItem = new Map(
      items.map((item) => [item.skladova_polozka_id, toNumber(item.requestedQuantity)])
    );
  } else if (zakazkaId) {
    const { data, error } = await supabase
      .from(SKLAD_TABLE.technikaNaZakazce)
      .select("skladova_polozka_id, mnozstvi")
      .eq("zakazka_id", zakazkaId);

    if (error) throw new Error(error.message);
    requestedByItem = new Map(
      (data ?? []).map((row: { skladova_polozka_id: string; mnozstvi: number | string | null }) => [
        row.skladova_polozka_id,
        toNumber(row.mnozstvi),
      ])
    );
  }

  const requestedIds = [...requestedByItem.keys()];

  const { data: allItemsRaw, error: allItemsError } = await supabase
    .from(SKLAD_TABLE.skladovePolozky)
    .select("skladova_polozka_id, nazev, aktivni")
    .eq("aktivni", true);

  if (allItemsError) throw new Error(allItemsError.message);

  const itemNameById = new Map<string, string | null>(
    (allItemsRaw ?? []).map((row: { skladova_polozka_id: string; nazev: string | null }) => [
      row.skladova_polozka_id,
      row.nazev,
    ])
  );

  const itemIds: string[] = requestedIds.length > 0 ? requestedIds : [...itemNameById.keys()];

  const { data: piecesRaw, error: piecesError } = await supabase
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id, skladova_polozka_id, stav, aktivni")
    .in("skladova_polozka_id", itemIds);

  if (piecesError) throw new Error(piecesError.message);

  const pieces = (piecesRaw ?? []) as Array<{
    kus_id: string;
    skladova_polozka_id: string;
    stav: string | null;
    aktivni: boolean | null;
  }>;
  const piecesById = new Map(pieces.map((piece) => [piece.kus_id, piece]));

  const totalByItem = countBy(pieces, (piece) => piece.skladova_polozka_id);
  const damagedByItem = countBy(pieces.filter((piece) => piece.stav === "poskozeno"), (piece) => piece.skladova_polozka_id);
  const blockedByItem = countBy(pieces.filter((piece) => piece.stav === "blokovano"), (piece) => piece.skladova_polozka_id);
  const repairByItem = countBy(pieces.filter((piece) => piece.stav === "v_oprave"), (piece) => piece.skladova_polozka_id);
  const pendingCheckByItem = countBy(pieces.filter((piece) => piece.stav === "ceka_na_kontrolu"), (piece) => piece.skladova_polozka_id);
  const retiredByItem = countBy(
    pieces.filter((piece) => piece.aktivni === false || piece.stav === "vyrazeno" || piece.stav === "odpis"),
    (piece) => piece.skladova_polozka_id
  );

  const { data: damageRaw, error: damageError } = await supabase
    .from(SKLAD_TABLE.hlaseniPoskozeni)
    .select("skladova_polozka_id, kus_id, pocet_kusu, blokuje_pouziti, datum_uzavreni")
    .in("skladova_polozka_id", itemIds)
    .is("datum_uzavreni", null);

  if (damageError) throw new Error(damageError.message);

  const openDamageByItem = new Map<string, { damaged: number; blocked: number }>();
  for (const row of damageRaw ?? []) {
    const itemId = String(row.skladova_polozka_id);
    const current = openDamageByItem.get(itemId) ?? { damaged: 0, blocked: 0 };
    if (row.kus_id) {
      if (row.blokuje_pouziti) current.blocked += 1;
      else current.damaged += 1;
    } else {
      const count = Math.max(0, toNumber(row.pocet_kusu));
      if (row.blokuje_pouziti) current.blocked += count;
      else current.damaged += count;
    }
    openDamageByItem.set(itemId, current);
  }

  let overlappingZakazkaIds: string[] = [];
  if (rangeFrom && rangeTo) {
    const { data: zakazkyRaw, error: zakazkyError } = await supabase
      .from(SKLAD_TABLE.zakazky)
      .select("zakazka_id, datum_od, datum_do, cas_od, cas_do, akce_od, akce_do, zrusena, workflow_stav")
      .neq("zakazka_id", zakazkaId ?? "__none__");

    if (zakazkyError) throw new Error(zakazkyError.message);

    overlappingZakazkaIds = ((zakazkyRaw ?? []) as ZakazkaRangeRow[])
      .filter((row) => !shouldIgnoreZakazka(row, rangeFrom))
      .filter((row) => overlaps(rangeFrom, rangeTo, getZakazkaStart(row), getZakazkaEnd(row)))
      .map((row) => row.zakazka_id);
  }

  const plannedByItem = new Map<string, number>();
  if (overlappingZakazkaIds.length > 0) {
    const { data: plannedRaw, error: plannedError } = await supabase
      .from(SKLAD_TABLE.technikaNaZakazce)
      .select("skladova_polozka_id, mnozstvi")
      .in("zakazka_id", overlappingZakazkaIds)
      .in("skladova_polozka_id", itemIds);

    if (plannedError) throw new Error(plannedError.message);

    for (const row of plannedRaw ?? []) {
      const itemId = String(row.skladova_polozka_id);
      plannedByItem.set(itemId, (plannedByItem.get(itemId) ?? 0) + toNumber(row.mnozstvi));
    }
  }

  const loadedByItem = new Map<string, number>();
  const reserveByItem = new Map<string, number>();
  if (overlappingZakazkaIds.length > 0) {
    const { data: assignmentsRaw, error: assignmentsError } = await supabase
      .from(SKLAD_TABLE.zakazkaKusy)
      .select("zakazka_id, kus_id, stav, is_rezerva")
      .in("zakazka_id", overlappingZakazkaIds)
      .neq("zakazka_id", zakazkaId ?? "__none__")
      .in("stav", ["rezervovano", "nalozeno", "vratit", "poskozeno"]);

    if (assignmentsError) throw new Error(assignmentsError.message);

    for (const assignment of assignmentsRaw ?? []) {
      const piece = piecesById.get(String(assignment.kus_id));
      if (!piece || !itemIds.includes(piece.skladova_polozka_id)) continue;
      const itemId = piece.skladova_polozka_id;
      loadedByItem.set(itemId, (loadedByItem.get(itemId) ?? 0) + 1);
      if (assignment.is_rezerva) reserveByItem.set(itemId, (reserveByItem.get(itemId) ?? 0) + 1);
    }
  }

  const idsForOutput = itemIds.filter((id) => itemNameById.has(id) || requestedByItem.has(id));
  const outputItems = idsForOutput.map((id) => {
    const damage = openDamageByItem.get(id) ?? { damaged: 0, blocked: 0 };
    const damagedPieces = Math.max(damagedByItem.get(id) ?? 0, damage.damaged);
    const blockedPieces = Math.max(blockedByItem.get(id) ?? 0, damage.blocked);
    const repairPieces = repairByItem.get(id) ?? 0;
    const pendingCheckPieces = pendingCheckByItem.get(id) ?? 0;
    const retiredPieces = retiredByItem.get(id) ?? 0;
    const totalPieces = totalByItem.get(id) ?? 0;
    const unusablePieces = damagedPieces + blockedPieces + repairPieces + pendingCheckPieces + retiredPieces;
    const usablePieces = Math.max(0, totalPieces - unusablePieces);
    const plannedOnOtherOverlappingZakazky = plannedByItem.get(id) ?? 0;
    const physicallyLoadedOnOtherZakazky = loadedByItem.get(id) ?? 0;
    const reservePiecesOnOtherZakazky = reserveByItem.get(id) ?? 0;
    const requestedQuantity = requestedByItem.get(id) ?? 0;
    const occupied = Math.max(plannedOnOtherOverlappingZakazky, physicallyLoadedOnOtherZakazky);
    const availableQuantity = Math.max(0, usablePieces - occupied);
    const missingQuantity = Math.max(0, requestedQuantity - availableQuantity);

    return {
      skladova_polozka_id: id,
      nazev: itemNameById.get(id) ?? null,
      totalPieces,
      usablePieces,
      damagedPieces,
      blockedPieces,
      repairPieces,
      pendingCheckPieces,
      retiredPieces,
      plannedOnOtherOverlappingZakazky,
      physicallyLoadedOnOtherZakazky,
      reservePiecesOnOtherZakazky,
      requestedQuantity,
      availableQuantity,
      missingQuantity,
      hasCollision: missingQuantity > 0,
    } satisfies TechnikaAvailabilityItem;
  });

  return { from: rangeFrom, to: rangeTo, zakazkaId, items: outputItems };
}
