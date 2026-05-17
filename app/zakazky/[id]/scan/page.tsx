import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ZakazkaSubnav } from "@/components/zakazky/zakazka-subnav";
import { getRolePermissions } from "@/lib/roles";
import { SKLAD_KUS_SELECT_FIELDS, SKLAD_TABLE } from "@/lib/sklad/constants";
import { insertSkladKusHistorie } from "@/lib/sklad/kusHistorie";
import { extractSkladKusIdFromInput } from "@/lib/sklad/kusLabels";
import { queryAktivniZakazkaKusu } from "@/lib/sklad/zakazkaKusy";
import { createClient } from "@/lib/supabase/server";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import { syncZakazkaLogisticsFromScan } from "@/lib/zakazka-logistics-sync";
import { getTechnikaAvailability } from "@/lib/technika-availability";
import { createNotificationsForRoles } from "@/lib/notifications";
import {
  ZakazkaLoadingScanClient,
  type LoadingOkruh,
  type MovementScanResult,
  type UnloadingOkruh,
} from "./ZakazkaLoadingScanClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ZakazkaInfo = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  datum_od: string | null;
  datum_do: string | null;
  cas_od: string | null;
  cas_do: string | null;
  zrusena?: boolean | null;
  workflow_stav?: string | null;
};

type SkladKusRowForScan = {
  kus_id: string;
  skladova_polozka_id: string;
  poradove_cislo: number;
  stav: string;
  aktivni: boolean;
};

type SkladPolozkaScanRow = {
  skladova_polozka_id: string;
  nazev: string;
  pozice: number | string | null;
  sklad_blok_id: string | null;
};

type SkladBlokScanRow = {
  sklad_blok_id: string;
  nazev: string;
  poradi: number | null;
};

type PlanRow = {
  skladova_polozka_id: string;
  mnozstvi: number | string | null;
};

type ZakazkaKusMovementRow = {
  id: string;
  zakazka_id: string;
  kus_id: string;
  stav: string;
  is_rezerva?: boolean | null;
  created_at?: string | null;
};

type DamageInfo = {
  poskozeni_id: string;
  typ_poskozeni: string | null;
  popis: string | null;
  priorita: string | null;
  blokuje_pouziti: boolean;
  stav_reseni: string | null;
};

type ScanDecision =
  | "force_damaged_load"
  | "force_capacity_load"
  | "use_replacement"
  | "return_to_stock"
  | "set_aside_damaged"
  | "load_reserve";

function formatZakazkaDate(zakazka: ZakazkaInfo) {
  const date = zakazka.datum_od && zakazka.datum_do
    ? `${zakazka.datum_od} – ${zakazka.datum_do}`
    : (zakazka.datum_od ?? zakazka.datum_do ?? "bez data");
  const time = zakazka.cas_od || zakazka.cas_do
    ? ` · ${zakazka.cas_od ?? "?"}–${zakazka.cas_do ?? "?"}`
    : "";

  return `${date}${time}`;
}

function isKusStateDamagedOrBlocked(stav: string | null | undefined) {
  return ["poskozeno", "blokovano", "v_oprave", "ceka_na_kontrolu", "odpis", "vyrazeno"].includes(
    String(stav ?? "")
  );
}

function formatDamageNote(kus: SkladKusRowForScan, damage: DamageInfo | null) {
  const parts = [
    damage?.typ_poskozeni ? `Typ: ${damage.typ_poskozeni}` : null,
    damage?.priorita ? `Priorita: ${damage.priorita}` : null,
    damage?.popis ? `Poznámka: ${damage.popis}` : null,
    damage?.blokuje_pouziti ? "Blokuje použití" : null,
    isKusStateDamagedOrBlocked(kus.stav) ? `Stav kusu: ${kus.stav}` : null,
  ].filter(Boolean);

  return parts.join(" · ") || "Kus je označený jako poškozený nebo blokovaný.";
}

async function queryOpenDamageForKus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kusId: string
) {
  const { data, error } = await supabase
    .from(SKLAD_TABLE.hlaseniPoskozeni)
    .select("poskozeni_id, typ_poskozeni, popis, priorita, blokuje_pouziti, stav_reseni")
    .eq("kus_id", kusId)
    .is("datum_uzavreni", null)
    .order("datum_nahlaseni", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as DamageInfo | null;
}

async function countLoadingForPolozka(
  supabase: Awaited<ReturnType<typeof createClient>>,
  zakazkaId: string,
  skladovaPolozkaId: string
) {
  const { data: loadedAssignments, error: assignmentsError } = await supabase
    .from(SKLAD_TABLE.zakazkaKusy)
    .select("kus_id, is_rezerva")
    .eq("zakazka_id", zakazkaId)
    .in("stav", ["nalozeno", "poskozeno"]);

  if (assignmentsError) throw new Error(assignmentsError.message);

  const kusIds = (loadedAssignments ?? [])
    .map((row) => String(row.kus_id ?? ""))
    .filter(Boolean);

  if (kusIds.length === 0) return { loaded: 0, reserve: 0, regular: 0 };

  const { data: loadedKusy, error: kusyError } = await supabase
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id, skladova_polozka_id")
    .in("kus_id", kusIds);

  if (kusyError) throw new Error(kusyError.message);

  const kusToPolozka = new Map(
    (loadedKusy ?? []).map((row) => [String(row.kus_id), String(row.skladova_polozka_id)])
  );
  let loaded = 0;
  let reserve = 0;

  for (const assignment of loadedAssignments ?? []) {
    if (kusToPolozka.get(String(assignment.kus_id)) !== skladovaPolozkaId) continue;
    loaded += 1;
    if (Boolean(assignment.is_rezerva)) reserve += 1;
  }

  return { loaded, reserve, regular: Math.max(loaded - reserve, 0) };
}

async function countLoadedByPolozka(
  supabase: Awaited<ReturnType<typeof createClient>>,
  zakazkaId: string
) {
  const { data: loadedAssignments, error: assignmentsError } = await supabase
    .from(SKLAD_TABLE.zakazkaKusy)
    .select("kus_id, is_rezerva")
    .eq("zakazka_id", zakazkaId)
    .in("stav", ["nalozeno", "poskozeno"]);

  if (assignmentsError) throw new Error(assignmentsError.message);

  const kusIds = (loadedAssignments ?? [])
    .map((row) => String(row.kus_id ?? ""))
    .filter(Boolean);

  if (kusIds.length === 0) return new Map<string, { loaded: number; reserve: number }>();

  const { data: loadedKusy, error: kusyError } = await supabase
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id, skladova_polozka_id")
    .in("kus_id", kusIds);

  if (kusyError) throw new Error(kusyError.message);

  const kusToPolozka = new Map(
    (loadedKusy ?? []).map((row) => [String(row.kus_id), String(row.skladova_polozka_id)])
  );
  const counts = new Map<string, { loaded: number; reserve: number }>();
  for (const assignment of loadedAssignments ?? []) {
    const polozkaId = kusToPolozka.get(String(assignment.kus_id)) ?? "";
    if (!polozkaId) continue;
    const current = counts.get(polozkaId) ?? { loaded: 0, reserve: 0 };
    current.loaded += 1;
    if (Boolean(assignment.is_rezerva)) current.reserve += 1;
    counts.set(polozkaId, current);
  }

  return counts;
}

function buildLoadingOkruhy(
  technika: PlanRow[],
  polozky: SkladPolozkaScanRow[],
  bloky: SkladBlokScanRow[],
  loadedCounts: Map<string, { loaded: number; reserve: number }>
): LoadingOkruh[] {
  const polozkaMap = new Map(polozky.map((polozka) => [polozka.skladova_polozka_id, polozka]));
  const blokMap = new Map(bloky.map((blok) => [blok.sklad_blok_id, blok]));
  const groups = new Map<string, LoadingOkruh>();

  for (const planRow of technika) {
    const polozkaId = planRow.skladova_polozka_id;
    const polozka = polozkaMap.get(polozkaId);
    const plan = Number(planRow.mnozstvi ?? 0);
    if (!Number.isFinite(plan) || plan <= 0) continue;

    const blok = polozka?.sklad_blok_id ? blokMap.get(polozka.sklad_blok_id) : null;
    const okruhId = blok?.sklad_blok_id ?? "__bez_okruhu";
    const okruhNazev = blok?.nazev ?? "Bez okruhu";
    const okruhPoradi = blok?.poradi ?? 999999;
    const loadingCounts = loadedCounts.get(polozkaId) ?? { loaded: 0, reserve: 0 };
    const loaded = loadingCounts.loaded;
    const reserve = loadingCounts.reserve;
    const remaining = Math.max(plan - Math.max(loaded - reserve, 0), 0);

    const item = {
      skladovaPolozkaId: polozkaId,
      nazev: polozka?.nazev ?? polozkaId,
      plan,
      loaded,
      reserve,
      remaining,
      pozice: polozka?.pozice ?? null,
      okruhId,
      okruhNazev,
      okruhPoradi,
      status:
        remaining <= 0
          ? "hotovo"
          : loaded > 0
            ? "rozpracovano"
            : "nenalozeno",
    } satisfies LoadingOkruh["items"][number];

    const existing = groups.get(okruhId);
    if (existing) {
      existing.items.push(item);
      existing.plan += item.plan;
      existing.loaded += item.loaded;
      existing.reserve += item.reserve;
      existing.remaining += item.remaining;
    } else {
      groups.set(okruhId, {
        okruhId,
        nazev: okruhNazev,
        poradi: okruhPoradi,
        plan: item.plan,
        loaded: item.loaded,
        reserve: item.reserve,
        remaining: item.remaining,
        items: [item],
      });
    }
  }

  return [...groups.values()]
    .map((okruh) => ({
      ...okruh,
      items: [...okruh.items].sort((a, b) => {
        const aPozice = Number(a.pozice);
        const bPozice = Number(b.pozice);
        if (Number.isFinite(aPozice) && Number.isFinite(bPozice) && aPozice !== bPozice) {
          return aPozice - bPozice;
        }
        return a.nazev.localeCompare(b.nazev, "cs");
      }),
    }))
    .sort((a, b) => {
      if (a.poradi !== b.poradi) return a.poradi - b.poradi;
      return a.nazev.localeCompare(b.nazev, "cs");
    });
}

function buildUnloadingOkruhy(
  polozky: SkladPolozkaScanRow[],
  bloky: SkladBlokScanRow[],
  counts: Map<string, { loaded: number; returned: number }>
): UnloadingOkruh[] {
  const polozkaMap = new Map(polozky.map((polozka) => [polozka.skladova_polozka_id, polozka]));
  const blokMap = new Map(bloky.map((blok) => [blok.sklad_blok_id, blok]));
  const groups = new Map<string, UnloadingOkruh>();

  for (const [polozkaId, itemCounts] of counts) {
    const totalTouched = itemCounts.loaded + itemCounts.returned;
    if (totalTouched <= 0) continue;

    const polozka = polozkaMap.get(polozkaId);
    const blok = polozka?.sklad_blok_id ? blokMap.get(polozka.sklad_blok_id) : null;
    const okruhId = blok?.sklad_blok_id ?? "__bez_okruhu";
    const okruhNazev = blok?.nazev ?? "Bez okruhu";
    const okruhPoradi = blok?.poradi ?? 999999;
    const remaining = itemCounts.loaded;

    const item = {
      skladovaPolozkaId: polozkaId,
      nazev: polozka?.nazev ?? polozkaId,
      loaded: itemCounts.loaded,
      returned: itemCounts.returned,
      remaining,
      pozice: polozka?.pozice ?? null,
      okruhId,
      okruhNazev,
      okruhPoradi,
      status:
        remaining <= 0
          ? "hotovo"
          : itemCounts.returned > 0
            ? "rozpracovano"
            : "nenalozeno",
    } satisfies UnloadingOkruh["items"][number];

    const existing = groups.get(okruhId);
    if (existing) {
      existing.items.push(item);
      existing.loaded += item.loaded;
      existing.returned += item.returned;
      existing.remaining += item.remaining;
    } else {
      groups.set(okruhId, {
        okruhId,
        nazev: okruhNazev,
        poradi: okruhPoradi,
        loaded: item.loaded,
        returned: item.returned,
        remaining: item.remaining,
        items: [item],
      });
    }
  }

  return [...groups.values()]
    .map((okruh) => ({
      ...okruh,
      items: [...okruh.items].sort((a, b) => {
        const aPozice = Number(a.pozice);
        const bPozice = Number(b.pozice);
        if (Number.isFinite(aPozice) && Number.isFinite(bPozice) && aPozice !== bPozice) {
          return aPozice - bPozice;
        }
        return a.nazev.localeCompare(b.nazev, "cs");
      }),
    }))
    .sort((a, b) => {
      if (a.poradi !== b.poradi) return a.poradi - b.poradi;
      return a.nazev.localeCompare(b.nazev, "cs");
    });
}

async function queryZakazkaKusyMovementCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  zakazkaId: string
) {
  const { data: assignmentsRaw, error: assignmentsError } = await supabase
    .from(SKLAD_TABLE.zakazkaKusy)
    .select("id, zakazka_id, kus_id, stav, is_rezerva, created_at")
    .eq("zakazka_id", zakazkaId)
    .in("stav", ["nalozeno", "vraceno"]);

  if (assignmentsError) throw new Error(assignmentsError.message);

  const assignments = (assignmentsRaw ?? []) as ZakazkaKusMovementRow[];
  const kusIds = assignments.map((row) => row.kus_id).filter(Boolean);
  if (kusIds.length === 0) {
    return {
      counts: new Map<string, { loaded: number; returned: number }>(),
      polozkaIds: [] as string[],
    };
  }

  const { data: kusyRaw, error: kusyError } = await supabase
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id, skladova_polozka_id")
    .in("kus_id", kusIds);

  if (kusyError) throw new Error(kusyError.message);

  const kusToPolozka = new Map(
    (kusyRaw ?? []).map((row) => [String(row.kus_id), String(row.skladova_polozka_id)])
  );
  const counts = new Map<string, { loaded: number; returned: number }>();

  for (const assignment of assignments) {
    const polozkaId = kusToPolozka.get(assignment.kus_id);
    if (!polozkaId) continue;

    const current = counts.get(polozkaId) ?? { loaded: 0, returned: 0 };
    if (assignment.stav === "nalozeno") current.loaded += 1;
    if (assignment.stav === "vraceno") current.returned += 1;
    counts.set(polozkaId, current);
  }

  return {
    counts,
    polozkaIds: [...counts.keys()],
  };
}

export default async function ZakazkaLoadingScanPage({ params }: PageProps) {
  noStore();

  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user?.id) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    role = data?.role ?? null;
  }

  const perms = getRolePermissions(role);

  if (!perms.nakladkaCteni) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4">
        <Card className="border-red-900/50 bg-red-950/30">
          <div className="flex items-center gap-3">
            <Badge variant="danger">Bez oprávnění</Badge>
            <div className="text-sm text-red-100">Nemáš oprávnění číst nakládku.</div>
          </div>
        </Card>
      </div>
    );
  }

  async function scanLoadKus(
    input: string,
    expectedSkladovaPolozkaId: string,
    decision?: ScanDecision,
    overrideReason?: string
  ): Promise<MovementScanResult> {
    "use server";

    const kusId = extractSkladKusIdFromInput(
      input,
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost"
    );

    if (!kusId) {
      return { ok: false, error: "QR neobsahuje platnou URL /sklad/kus/[kus_id] ani kus_id." };
    }

    const cleanExpectedPolozkaId = expectedSkladovaPolozkaId.trim();
    if (!cleanExpectedPolozkaId) {
      return { ok: false, error: "Nejdřív vyber položku checklistu." };
    }

    if (!perms.nakladkaEditace) {
      return { ok: false, error: "Nemáš oprávnění upravovat nakládku." };
    }

    const supabase = await createClient();
    const { data: currentZakazka, error: currentZakazkaError } = await supabase
      .from(SKLAD_TABLE.zakazky)
      .select("zrusena, workflow_stav")
      .eq("zakazka_id", id)
      .maybeSingle();

    if (currentZakazkaError) return { ok: false, error: currentZakazkaError.message };
    if (currentZakazka?.zrusena || currentZakazka?.workflow_stav === "zruseno") {
      return { ok: false, error: "Zakázka byla zrušena. Scan workflow je neaktivní." };
    }

    const { data: kusRaw, error: kusError } = await supabase
      .from(SKLAD_TABLE.skladPolozkyKusy)
      .select(SKLAD_KUS_SELECT_FIELDS)
      .eq("kus_id", kusId)
      .maybeSingle();

    if (kusError) return { ok: false, error: kusError.message };
    if (!kusRaw) return { ok: false, error: "Kus nebyl nalezen." };

    const kus = kusRaw as SkladKusRowForScan;

    if (!kus.aktivni) {
      return { ok: false, error: "Kus je neaktivní a nelze ho naložit." };
    }

    let damage: DamageInfo | null = null;
    try {
      damage = await queryOpenDamageForKus(supabase, kus.kus_id);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Poškození kusu se nepodařilo načíst.",
      };
    }

    const { data: plannedItemRaw, error: plannedItemError } = await supabase
      .from(SKLAD_TABLE.skladovePolozky)
      .select("skladova_polozka_id, nazev, pozice, sklad_blok_id")
      .eq("skladova_polozka_id", cleanExpectedPolozkaId)
      .maybeSingle();

    if (plannedItemError) return { ok: false, error: plannedItemError.message };
    if (!plannedItemRaw) return { ok: false, error: "Plánovaná skladová položka nebyla nalezena." };

    const plannedItem = plannedItemRaw as SkladPolozkaScanRow;

    const { data: scannedItemRaw, error: scannedItemError } = await supabase
      .from(SKLAD_TABLE.skladovePolozky)
      .select("skladova_polozka_id, nazev, pozice, sklad_blok_id")
      .eq("skladova_polozka_id", kus.skladova_polozka_id)
      .maybeSingle();

    if (scannedItemError) return { ok: false, error: scannedItemError.message };
    if (!scannedItemRaw) return { ok: false, error: "Skladová položka naskenovaného kusu nebyla nalezena." };

    const scannedItem = scannedItemRaw as SkladPolozkaScanRow;
    const isReplacement = kus.skladova_polozka_id !== cleanExpectedPolozkaId;
    const isReserve = decision === "load_reserve";
    const damageNote = formatDamageNote(kus, damage);
    const isDamagedOrBlocked = Boolean(damage) || isKusStateDamagedOrBlocked(kus.stav);
    const trimmedOverrideReason = String(overrideReason ?? "").trim();

    if (isReserve && isReplacement) {
      return {
        ok: false,
        error: "Rezervu lze zatím naložit jen ze stejné skladové položky.",
      };
    }

    if (isReplacement && decision !== "use_replacement" && decision !== "force_capacity_load") {
      return {
        ok: false,
        requiresDecision: true,
        decision: "loading-replacement",
        warning: "Naskenovaný kus je jiná položka než plán.",
        kus: {
          kusId: kus.kus_id,
          itemName: scannedItem.nazev,
          poradoveCislo: kus.poradove_cislo,
          pozice: scannedItem.pozice,
        },
        damageNote: isDamagedOrBlocked ? damageNote : null,
        plannedItemName: plannedItem.nazev,
      };
    }

    if (
      isDamagedOrBlocked &&
      !isReplacement &&
      decision !== "force_damaged_load" &&
      decision !== "force_capacity_load"
    ) {
      return {
        ok: false,
        requiresDecision: true,
        decision: "loading-damaged",
        warning: "Kus je poškozený nebo blokovaný.",
        kus: {
          kusId: kus.kus_id,
          itemName: scannedItem.nazev,
          poradoveCislo: kus.poradove_cislo,
          pozice: scannedItem.pozice,
        },
        damageNote,
        plannedItemName: plannedItem.nazev,
      };
    }

    if (
      isDamagedOrBlocked &&
      (decision === "force_damaged_load" ||
        decision === "use_replacement" ||
        decision === "force_capacity_load") &&
      !trimmedOverrideReason
    ) {
      return { ok: false, error: "U naložení problémového kusu je povinný důvod override." };
    }

    const { data: planRaw, error: planError } = await supabase
      .from(SKLAD_TABLE.technikaNaZakazce)
      .select("skladova_polozka_id, mnozstvi")
      .eq("zakazka_id", id)
      .eq("skladova_polozka_id", cleanExpectedPolozkaId)
      .maybeSingle();

    if (planError) return { ok: false, error: planError.message };
    if (!planRaw) {
      return { ok: false, error: "Kus nepatří do plánu této zakázky." };
    }

    const plan = planRaw as PlanRow;
    const planCount = Number(plan.mnozstvi ?? 0);
    if (!Number.isFinite(planCount) || planCount <= 0) {
      return { ok: false, error: "Tento typ techniky nemá na zakázce kladné plánované množství." };
    }

    const availability = await getTechnikaAvailability({
      supabase,
      zakazkaId: id,
      items: [{ skladova_polozka_id: cleanExpectedPolozkaId, requestedQuantity: planCount }],
    });
    const availabilityItem = availability.items[0];
    const hasCapacityCollision = Boolean(availabilityItem?.hasCollision);
    if (hasCapacityCollision && decision !== "force_capacity_load") {
      return {
        ok: false,
        requiresDecision: true,
        decision: "loading-capacity",
        warning: "Položka je v kapacitní kolizi s jinou zakázkou nebo servisním stavem skladu.",
        kus: {
          kusId: kus.kus_id,
          itemName: scannedItem.nazev,
          poradoveCislo: kus.poradove_cislo,
          pozice: scannedItem.pozice,
        },
        plannedItemName: plannedItem.nazev,
        damageNote: `Plán ${availabilityItem?.requestedQuantity ?? planCount} ks, dostupné ${availabilityItem?.availableQuantity ?? 0} ks, chybí ${availabilityItem?.missingQuantity ?? 0} ks.`,
      };
    }

    if (hasCapacityCollision && decision === "force_capacity_load" && !trimmedOverrideReason) {
      return { ok: false, error: "U naložení přes kapacitní kolizi je povinný důvod override." };
    }

    const { data: activeAssignment, error: assignmentError } =
      await queryAktivniZakazkaKusu(supabase, kus.kus_id);

    if (assignmentError) return { ok: false, error: assignmentError.message };
    if (activeAssignment?.zakazka_id === id) {
      return { ok: false, error: "Kus už je naložený nebo aktivní na této zakázce." };
    }
    if (activeAssignment) {
      return { ok: false, error: "Kus už je na jiné aktivní zakázce." };
    }

    const loadingCounts = await countLoadingForPolozka(
      supabase,
      id,
      cleanExpectedPolozkaId
    );

    if (!isReserve && loadingCounts.regular >= planCount) {
      return { ok: false, error: "Překročené množství: plán pro tento typ už je naložený." };
    }

    if (isReserve && loadingCounts.regular < planCount) {
      return { ok: false, error: "Rezervu lze naložit až po splnění plánovaného množství." };
    }

    const historyNotes = [
      isReserve
        ? "Kus naložen jako rezerva nad plán."
        : "Kus naložen scanem v loading workflow zakázky.",
      isReplacement ? `Náhrada za plánovanou položku: ${plannedItem.nazev}` : null,
      isDamagedOrBlocked ? `Naložen problémový kus: ${damageNote}. Důvod override: ${trimmedOverrideReason}` : null,
    ].filter(Boolean);

    const { error: insertError } = await supabase.from(SKLAD_TABLE.zakazkaKusy).insert({
      zakazka_id: id,
      kus_id: kus.kus_id,
      stav: "nalozeno",
      is_rezerva: isReserve,
    });

    if (insertError) return { ok: false, error: insertError.message };

    const { error: historyError } = await insertSkladKusHistorie(supabase, {
      kusId: kus.kus_id,
      zakazkaId: id,
      typAkce: "nalozeno",
      poznamka: historyNotes.join(" "),
    });

    if (historyError) return { ok: false, error: historyError.message };

    if (isDamagedOrBlocked) {
      await logZakazkaHistory(supabase, {
        zakazkaId: id,
        eventType: "stock_problem_piece_loaded_override",
        actorId: user?.id ?? null,
        title: "Problémový kus byl naložen přes override.",
        detail: trimmedOverrideReason,
        metadata: {
          kus_id: kus.kus_id,
          skladova_polozka_id: kus.skladova_polozka_id,
          kus_stav: kus.stav,
          damage_note: damageNote,
          decision,
        },
      });
      await createNotificationsForRoles(supabase, ["admin", "sef", "skladnik"], {
        type: "stock_problem_piece_loaded_override",
        priority: "critical",
        title: "Problémový kus naložen přes override",
        message: trimmedOverrideReason || damageNote,
        relatedZakazkaId: id,
        relatedKusId: kus.kus_id,
        actionUrl: `/zakazky/${id}/scan`,
        dedupeKeyPrefix: `problem-piece-loaded:${id}:${kus.kus_id}:${Date.now()}`,
      });
    }

    if (hasCapacityCollision) {
      await logZakazkaHistory(supabase, {
        zakazkaId: id,
        eventType: "stock_capacity_collision_override",
        actorId: user?.id ?? null,
        title: "Kapacitní kolize techniky byla povolena při scanu.",
        detail: trimmedOverrideReason,
        metadata: {
          skladova_polozka_id: cleanExpectedPolozkaId,
          kus_id: kus.kus_id,
          planned_quantity: availabilityItem?.requestedQuantity ?? planCount,
          available_quantity: availabilityItem?.availableQuantity ?? 0,
          missing_quantity: availabilityItem?.missingQuantity ?? 0,
          planned_elsewhere: availabilityItem?.plannedOnOtherOverlappingZakazky ?? 0,
          physically_loaded_elsewhere: availabilityItem?.physicallyLoadedOnOtherZakazky ?? 0,
        },
      });
      await createNotificationsForRoles(supabase, ["admin", "sef", "skladnik"], {
        type: "stock_capacity_collision_override",
        priority: "warning",
        title: "Kapacitní kolize při scanu",
        message: trimmedOverrideReason,
        relatedZakazkaId: id,
        relatedKusId: kus.kus_id,
        actionUrl: `/zakazky/${id}/scan`,
        dedupeKeyPrefix: `scan-capacity-override:${id}:${kus.kus_id}:${Date.now()}`,
      });
    }

    const logisticsSync = await syncZakazkaLogisticsFromScan(supabase, {
      zakazkaId: id,
      actorId: user?.id ?? null,
    });

    if (!logisticsSync.ok) {
      console.error("Logistics sync after loading scan failed:", logisticsSync.error);
    }

    revalidatePath(`/zakazky/${id}/scan`);
    revalidatePath(`/zakazky/${id}/nakladka`);
    revalidatePath(`/zakazky/${id}/technika`);
    revalidatePath(`/sklad/kus/${kus.kus_id}`);
    revalidatePath("/sklad/sprava");

    return {
      ok: true,
      action: "nalozeno",
      message: "Naloženo",
      kus: {
        kusId: kus.kus_id,
        itemName: scannedItem.nazev,
        poradoveCislo: kus.poradove_cislo,
        pozice: scannedItem.pozice,
      },
      counts: {
        plan: planCount,
        loaded: loadingCounts.loaded + 1,
        reserve: loadingCounts.reserve + (isReserve ? 1 : 0),
        remaining: Math.max(
          planCount - (loadingCounts.regular + (isReserve ? 0 : 1)),
          0
        ),
      },
      replacementFor: isReplacement ? plannedItem.nazev : null,
    };
  }

  async function scanUnloadKus(
    input: string,
    expectedSkladovaPolozkaId: string,
    decision?: ScanDecision,
    _overrideReason?: string
  ): Promise<MovementScanResult> {
    "use server";

    const kusId = extractSkladKusIdFromInput(
      input,
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost"
    );

    if (!kusId) {
      return { ok: false, error: "QR neobsahuje platnou URL /sklad/kus/[kus_id] ani kus_id." };
    }

    const cleanExpectedPolozkaId = expectedSkladovaPolozkaId.trim();
    if (!cleanExpectedPolozkaId) {
      return { ok: false, error: "Nejdřív vyber položku checklistu." };
    }

    if (!perms.nakladkaEditace) {
      return { ok: false, error: "Nemáš oprávnění upravovat vykládku." };
    }

    const supabase = await createClient();
    const { data: currentZakazka, error: currentZakazkaError } = await supabase
      .from(SKLAD_TABLE.zakazky)
      .select("zrusena, workflow_stav")
      .eq("zakazka_id", id)
      .maybeSingle();

    if (currentZakazkaError) return { ok: false, error: currentZakazkaError.message };
    if (currentZakazka?.zrusena || currentZakazka?.workflow_stav === "zruseno") {
      return { ok: false, error: "Zakázka byla zrušena. Scan workflow je neaktivní." };
    }

    const { data: kusRaw, error: kusError } = await supabase
      .from(SKLAD_TABLE.skladPolozkyKusy)
      .select(SKLAD_KUS_SELECT_FIELDS)
      .eq("kus_id", kusId)
      .maybeSingle();

    if (kusError) return { ok: false, error: kusError.message };
    if (!kusRaw) return { ok: false, error: "Kus nebyl nalezen." };

    const kus = kusRaw as SkladKusRowForScan;
    if (kus.skladova_polozka_id !== cleanExpectedPolozkaId) {
      return {
        ok: false,
        error: "Naskenovaný kus nepatří k vybrané skladové položce.",
      };
    }

    const { data: itemRaw, error: itemError } = await supabase
      .from(SKLAD_TABLE.skladovePolozky)
      .select("skladova_polozka_id, nazev, pozice, sklad_blok_id")
      .eq("skladova_polozka_id", cleanExpectedPolozkaId)
      .maybeSingle();

    if (itemError) return { ok: false, error: itemError.message };
    if (!itemRaw) return { ok: false, error: "Skladová položka kusu nebyla nalezena." };

    const item = itemRaw as SkladPolozkaScanRow;
    let damage: DamageInfo | null = null;
    try {
      damage = await queryOpenDamageForKus(supabase, kus.kus_id);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Poškození kusu se nepodařilo načíst.",
      };
    }

    const { data: assignmentsRaw, error: assignmentsError } = await supabase
      .from(SKLAD_TABLE.zakazkaKusy)
      .select("id, zakazka_id, kus_id, stav, is_rezerva, created_at")
      .eq("kus_id", kus.kus_id)
      .order("created_at", { ascending: false });

    if (assignmentsError) return { ok: false, error: assignmentsError.message };

    const assignments = (assignmentsRaw ?? []) as ZakazkaKusMovementRow[];
    const assignment = assignments.find((row) => row.zakazka_id === id);

    if (!assignment) {
      return { ok: false, error: "Kus nepatří této zakázce." };
    }

    if (assignment.stav === "vraceno") {
      return { ok: false, error: "Kus už je vrácen." };
    }

    if (assignment.stav !== "nalozeno") {
      return { ok: false, error: "Kus není naložen." };
    }

    const damageNote = formatDamageNote(kus, damage);
    const isDamagedOrBlocked = Boolean(damage) || isKusStateDamagedOrBlocked(kus.stav);
    if (
      isDamagedOrBlocked &&
      decision !== "return_to_stock" &&
      decision !== "set_aside_damaged"
    ) {
      return {
        ok: false,
        requiresDecision: true,
        decision: "unloading-damaged",
        warning: "Kus má evidované poškození nebo blokaci.",
        kus: {
          kusId: kus.kus_id,
          itemName: item.nazev,
          poradoveCislo: kus.poradove_cislo,
          pozice: item.pozice,
        },
        damageNote,
        plannedItemName: null,
      };
    }

    const nextStav = decision === "set_aside_damaged" ? "poskozeno" : "vraceno";
    const historyTypAkce = decision === "set_aside_damaged" ? "poskozeno" : "vraceno";

    const { error: updateError } = await supabase
      .from(SKLAD_TABLE.zakazkaKusy)
      .update({ stav: nextStav })
      .eq("id", assignment.id)
      .eq("zakazka_id", id)
      .eq("kus_id", kus.kus_id)
      .eq("stav", "nalozeno");

    if (updateError) return { ok: false, error: updateError.message };

    const { error: historyError } = await insertSkladKusHistorie(supabase, {
      kusId: kus.kus_id,
      zakazkaId: id,
      typAkce: historyTypAkce,
      poznamka:
        decision === "set_aside_damaged"
          ? `Kus odložen mimo běžný sklad při vykládce. ${damageNote}`
          : isDamagedOrBlocked
            ? `Kus vrácen do běžného skladu navzdory evidovanému poškození. ${damageNote}`
            : "Kus vrácen scanem v unloading workflow zakázky.",
    });

    if (historyError) return { ok: false, error: historyError.message };

    const logisticsSync = await syncZakazkaLogisticsFromScan(supabase, {
      zakazkaId: id,
      actorId: user?.id ?? null,
    });

    if (!logisticsSync.ok) {
      console.error("Logistics sync after unloading scan failed:", logisticsSync.error);
    }

    const { counts } = await queryZakazkaKusyMovementCounts(supabase, id);
    const itemCounts = counts.get(cleanExpectedPolozkaId) ?? { loaded: 0, returned: 0 };

    revalidatePath(`/zakazky/${id}/scan`);
    revalidatePath(`/zakazky/${id}/nakladka`);
    revalidatePath(`/zakazky/${id}/technika`);
    revalidatePath(`/sklad/kus/${kus.kus_id}`);
    revalidatePath("/sklad/sprava");

    return {
      ok: true,
      action: nextStav,
      message: nextStav === "poskozeno" ? "Odloženo mimo" : "Vráceno",
      kus: {
        kusId: kus.kus_id,
        itemName: item.nazev,
        poradoveCislo: kus.poradove_cislo,
        pozice: item.pozice,
      },
      counts: {
        loaded: itemCounts.loaded,
        returned: itemCounts.returned,
        remaining: itemCounts.loaded,
      },
    };
  }

  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from(SKLAD_TABLE.zakazky)
    .select("zakazka_id, cislo_zakazky, nazev, datum_od, datum_do, cas_od, cas_do, zrusena, workflow_stav")
    .eq("zakazka_id", id)
    .maybeSingle();

  if (zakazkaError) {
    return <div>Chyba zakázky: {zakazkaError.message}</div>;
  }

  const zakazka = (zakazkaRaw ?? null) as ZakazkaInfo | null;

  if (!zakazka) {
    return <div>Zakázka nebyla nalezena.</div>;
  }

  if (zakazka.zrusena || zakazka.workflow_stav === "zruseno") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4">
        <PageHeader
          title="Loading scan"
          description={`${zakazka.cislo_zakazky ?? "—"} — ${zakazka.nazev ?? "Zakázka"}`}
        />
        <Card className="border-red-500/30 bg-red-500/10">
          <Badge variant="danger">Zrušeno</Badge>
          <div className="mt-3 text-sm font-semibold text-red-100">
            Zakázka byla zrušena. Scan workflow je neaktivní.
          </div>
        </Card>
      </div>
    );
  }

  const { data: technikaRaw, error: technikaError } = await supabase
    .from(SKLAD_TABLE.technikaNaZakazce)
    .select("skladova_polozka_id, mnozstvi")
    .eq("zakazka_id", id);

  if (technikaError) {
    return <div>Chyba techniky: {technikaError.message}</div>;
  }

  const technika = (technikaRaw ?? []) as PlanRow[];
  const plannedPolozkaIds = technika
    .map((row) => row.skladova_polozka_id)
    .filter(Boolean);

  let movementCounts = new Map<string, { loaded: number; returned: number }>();
  let movementPolozkaIds: string[] = [];
  try {
    const movement = await queryZakazkaKusyMovementCounts(supabase, id);
    movementCounts = movement.counts;
    movementPolozkaIds = movement.polozkaIds;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznámá chyba";
    return <div>Chyba načtení fyzických kusů: {message}</div>;
  }

  const relevantPolozkaIds = [...new Set([...plannedPolozkaIds, ...movementPolozkaIds])];

  let polozky: SkladPolozkaScanRow[] = [];
  if (relevantPolozkaIds.length > 0) {
    const { data: polozkyRaw, error: polozkyError } = await supabase
      .from(SKLAD_TABLE.skladovePolozky)
      .select("skladova_polozka_id, nazev, pozice, sklad_blok_id")
      .in("skladova_polozka_id", relevantPolozkaIds);

    if (polozkyError) {
      return <div>Chyba skladu: {polozkyError.message}</div>;
    }

    polozky = (polozkyRaw ?? []) as SkladPolozkaScanRow[];
  }

  const blokIds = [...new Set(polozky.map((polozka) => polozka.sklad_blok_id).filter(Boolean))] as string[];
  let bloky: SkladBlokScanRow[] = [];
  if (blokIds.length > 0) {
    const { data: blokyRaw, error: blokyError } = await supabase
      .from(SKLAD_TABLE.skladBloky)
      .select("sklad_blok_id, nazev, poradi")
      .in("sklad_blok_id", blokIds);

    if (blokyError) {
      return <div>Chyba okruhů: {blokyError.message}</div>;
    }

    bloky = (blokyRaw ?? []) as SkladBlokScanRow[];
  }

  let initialOkruhy: LoadingOkruh[] = [];
  let initialUnloadingOkruhy: UnloadingOkruh[] = [];
  try {
    const loadedCounts = await countLoadedByPolozka(supabase, id);
    initialOkruhy = buildLoadingOkruhy(technika, polozky, bloky, loadedCounts);
    initialUnloadingOkruhy = buildUnloadingOkruhy(polozky, bloky, movementCounts);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznámá chyba";
    return <div>Chyba načtení naložených kusů: {message}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <PageHeader
        title="Loading scan"
        description={`${zakazka.cislo_zakazky ?? "—"} — ${zakazka.nazev ?? "Zakázka"}`}
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {zakazka.cislo_zakazky ? (
                <Badge variant="default">{zakazka.cislo_zakazky}</Badge>
              ) : null}
              <Badge variant={perms.nakladkaEditace ? "success" : "warning"}>
                {perms.nakladkaEditace ? "Scan povolen" : "Jen čtení"}
              </Badge>
            </div>
            <div className="text-2xl font-black text-white">
              {zakazka.nazev ?? "Zakázka"}
            </div>
            <div className="text-sm text-slate-400">{formatZakazkaDate(zakazka)}</div>
            <div className="text-sm text-slate-400">
              Zakázka plánuje množství v technice; konkrétní kus vznikne až tady scanem.
            </div>
          </div>

          <ZakazkaSubnav zakazkaId={id} active="nakladka" />
        </div>
      </Card>

      <ZakazkaLoadingScanClient
        initialLoadingOkruhy={initialOkruhy}
        initialUnloadingOkruhy={initialUnloadingOkruhy}
        processLoadingScanAction={scanLoadKus}
        processUnloadingScanAction={scanUnloadKus}
      />

      <div className="mt-5">
        <Link
          href={`/zakazky/${id}/scan`}
          className="inline-flex rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Zpět na scan
        </Link>
      </div>
    </div>
  );
}
