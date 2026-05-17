import { revalidatePath } from "next/cache";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { logZakazkaHistory } from "@/lib/zakazka-history";

type LogisticsStatus =
  | "ceka_na_nakladku"
  | "naklada_se"
  | "nalozeno"
  | "vykladka"
  | "vraceno";

type SyncInput = {
  zakazkaId: string;
  actorId?: string | null;
};

type ZakazkaLogisticsRow = {
  logistika_stav: string | null;
  nakladka_started_by: string | null;
  nakladka_started_at: string | null;
  nakladka_completed_by: string | null;
  nakladka_completed_at: string | null;
  vykladka_started_by: string | null;
  vykladka_started_at: string | null;
  vraceno_completed_by: string | null;
  vraceno_completed_at: string | null;
};

type ZakazkaKusRow = {
  stav: string | null;
};

type PlanRow = {
  mnozstvi: number | string | null;
};

type ScanHistoryRow = {
  typ_akce: string | null;
};

function normalizeLogisticsStatus(value?: string | null): LogisticsStatus {
  if (value === "naklada_se") return "naklada_se";
  if (value === "nalozeno") return "nalozeno";
  if (value === "vykladka") return "vykladka";
  if (value === "vraceno") return "vraceno";
  return "ceka_na_nakladku";
}

function getStatusLabel(value: LogisticsStatus) {
  if (value === "naklada_se") return "Nakládá se";
  if (value === "nalozeno") return "Naloženo";
  if (value === "vykladka") return "Probíhá vykládka";
  if (value === "vraceno") return "Vráceno";
  return "Čeká na nakládku";
}

function getAutomaticHistoryTitle(value: LogisticsStatus) {
  if (value === "naklada_se") {
    return "Zakázka automaticky přepnuta na Nakládá se po prvním scanu nakládky.";
  }

  if (value === "nalozeno") {
    return "Zakázka automaticky přepnuta na Naloženo po dokončení checklistu.";
  }

  if (value === "vykladka") {
    return "Zakázka automaticky přepnuta na Probíhá vykládka po prvním scanu vracení.";
  }

  if (value === "vraceno") {
    return "Zakázka automaticky přepnuta na Vráceno po vrácení všech kusů.";
  }

  return "Zakázka automaticky přepnuta na Čeká na nakládku, protože zatím nemá žádný scan.";
}

function getPlannedCount(rows: PlanRow[]) {
  return rows.reduce((sum, row) => {
    const count = Number(row.mnozstvi ?? 0);
    return sum + (Number.isFinite(count) && count > 0 ? count : 0);
  }, 0);
}

function deriveLogisticsStatus({
  planCount,
  assignments,
  history,
}: {
  planCount: number;
  assignments: ZakazkaKusRow[];
  history: ScanHistoryRow[];
}) {
  const hasLoadScan =
    history.some((row) => row.typ_akce === "nalozeno") ||
    assignments.some((row) => row.stav === "nalozeno" || row.stav === "vraceno" || row.stav === "poskozeno");
  const hasReturnScan =
    history.some((row) => row.typ_akce === "vraceno" || row.typ_akce === "poskozeno") ||
    assignments.some((row) => row.stav === "vraceno" || row.stav === "poskozeno");

  if (!hasLoadScan && !hasReturnScan) return "ceka_na_nakladku" satisfies LogisticsStatus;

  const loadedOrTouchedCount = assignments.filter((row) =>
    row.stav === "nalozeno" ||
    row.stav === "vraceno" ||
    row.stav === "poskozeno" ||
    row.stav === "vratit"
  ).length;
  const unreturnedCount = assignments.filter((row) => row.stav === "nalozeno" || row.stav === "vratit").length;

  if (hasReturnScan) {
    return unreturnedCount === 0 ? "vraceno" : "vykladka";
  }

  if (planCount > 0 && loadedOrTouchedCount >= planCount) return "nalozeno";
  return "naklada_se";
}

function getAuditPatch({
  nextStatus,
  current,
  actorId,
  timestamp,
}: {
  nextStatus: LogisticsStatus;
  current: ZakazkaLogisticsRow;
  actorId?: string | null;
  timestamp: string;
}) {
  const patch: Record<string, string | null> = {};

  if ((nextStatus === "naklada_se" || nextStatus === "nalozeno" || nextStatus === "vykladka" || nextStatus === "vraceno") && !current.nakladka_started_at) {
    patch.nakladka_started_by = actorId ?? null;
    patch.nakladka_started_at = timestamp;
  }

  if ((nextStatus === "nalozeno" || nextStatus === "vykladka" || nextStatus === "vraceno") && !current.nakladka_completed_at) {
    patch.nakladka_completed_by = actorId ?? null;
    patch.nakladka_completed_at = timestamp;
  }

  if ((nextStatus === "vykladka" || nextStatus === "vraceno") && !current.vykladka_started_at) {
    patch.vykladka_started_by = actorId ?? null;
    patch.vykladka_started_at = timestamp;
  }

  if (nextStatus === "vraceno" && !current.vraceno_completed_at) {
    patch.vraceno_completed_by = actorId ?? null;
    patch.vraceno_completed_at = timestamp;
  }

  return patch;
}

export async function syncZakazkaLogisticsFromScan(
  supabase: any,
  { zakazkaId, actorId }: SyncInput
) {
  const { data: zakazkaRaw, error: zakazkaError } = await supabase
    .from(SKLAD_TABLE.zakazky)
    .select("logistika_stav, nakladka_started_by, nakladka_started_at, nakladka_completed_by, nakladka_completed_at, vykladka_started_by, vykladka_started_at, vraceno_completed_by, vraceno_completed_at")
    .eq("zakazka_id", zakazkaId)
    .maybeSingle();

  if (zakazkaError || !zakazkaRaw) {
    return { ok: false, error: zakazkaError?.message ?? "Zakázka nebyla nalezena." };
  }

  const { data: assignmentsRaw, error: assignmentsError } = await supabase
    .from(SKLAD_TABLE.zakazkaKusy)
    .select("stav")
    .eq("zakazka_id", zakazkaId);

  if (assignmentsError) return { ok: false, error: assignmentsError.message };

  const { data: planRaw, error: planError } = await supabase
    .from(SKLAD_TABLE.technikaNaZakazce)
    .select("mnozstvi")
    .eq("zakazka_id", zakazkaId);

  if (planError) return { ok: false, error: planError.message };

  const { data: historyRaw, error: historyError } = await supabase
    .from(SKLAD_TABLE.skladKusHistorie)
    .select("typ_akce")
    .eq("zakazka_id", zakazkaId);

  if (historyError) return { ok: false, error: historyError.message };

  const current = zakazkaRaw as ZakazkaLogisticsRow;
  const assignments = (assignmentsRaw ?? []) as ZakazkaKusRow[];
  const planCount = getPlannedCount((planRaw ?? []) as PlanRow[]);
  const nextStatus = deriveLogisticsStatus({
    planCount,
    assignments,
    history: (historyRaw ?? []) as ScanHistoryRow[],
  });
  const currentStatus = normalizeLogisticsStatus(current.logistika_stav);
  const timestamp = new Date().toISOString();
  const auditPatch = getAuditPatch({ nextStatus, current, actorId, timestamp });
  const shouldUpdateStatus = nextStatus !== currentStatus;
  const shouldUpdateAudit = Object.keys(auditPatch).length > 0;

  if (!shouldUpdateStatus && !shouldUpdateAudit) {
    return { ok: true, status: currentStatus, changed: false };
  }

  const updatePayload = {
    ...(shouldUpdateStatus ? { logistika_stav: nextStatus } : {}),
    ...auditPatch,
  };
  const { error: updateError } = await supabase
    .from(SKLAD_TABLE.zakazky)
    .update(updatePayload)
    .eq("zakazka_id", zakazkaId);

  if (updateError) return { ok: false, error: updateError.message };

  if (shouldUpdateStatus) {
    await logZakazkaHistory(supabase, {
      zakazkaId,
      eventType: `logistics_auto_${nextStatus}`,
      actorId: actorId ?? null,
      title: getAutomaticHistoryTitle(nextStatus),
      detail: `Předchozí stav: ${getStatusLabel(currentStatus)} → ${getStatusLabel(nextStatus)}.`,
      metadata: {
        source: "scan_workflow",
        previous_status: currentStatus,
        next_status: nextStatus,
        plan_count: planCount,
        scanned_count: assignments.length,
      },
    });
  }

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath(`/zakazky/${zakazkaId}/scan`);
  revalidatePath(`/zakazky/${zakazkaId}/nakladka`);
  revalidatePath(`/zakazky/${zakazkaId}/technika`);
  revalidatePath("/zakazky");
  revalidatePath("/moje");
  revalidatePath(`/moje/zakazky/${zakazkaId}`);

  return { ok: true, status: nextStatus, changed: shouldUpdateStatus };
}
