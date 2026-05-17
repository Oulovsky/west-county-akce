import { logZakazkaHistory } from "@/lib/zakazka-history";
import {
  normalizeWorkflowStatus,
  type ZakazkaWorkflowStatus,
} from "@/lib/zakazka-workflow";

export type CriticalChangeType =
  | "termin"
  | "misto"
  | "gps"
  | "technicky_plan"
  | "setupy"
  | "lide"
  | "fakturacni_firma"
  | "cena_techniky"
  | "cena_personalu"
  | "sleva"
  | "konecna_cena";

const APPROVED_OR_LATER: ZakazkaWorkflowStatus[] = [
  "schvaleno_klientem",
  "priprava",
  "v_realizaci",
  "dokonceno",
  "fakturovano",
  "archiv",
];

export function isApprovedOrLaterWorkflowStatus(value?: string | null) {
  return APPROVED_OR_LATER.includes(normalizeWorkflowStatus(value));
}

export function getCriticalChangeLabel(value: CriticalChangeType) {
  if (value === "termin") return "Termín";
  if (value === "misto") return "Místo";
  if (value === "gps") return "GPS";
  if (value === "technicky_plan") return "Technický plán";
  if (value === "setupy") return "Setupy";
  if (value === "lide") return "Lidé / pokrytí práce";
  if (value === "fakturacni_firma") return "Fakturační firma";
  if (value === "cena_techniky") return "Cena techniky";
  if (value === "cena_personalu") return "Cena personálu";
  if (value === "sleva") return "Sleva";
  return "Konečná cena";
}

export async function markZakazkaCriticalChangeIfApproved(
  supabase: any,
  {
    zakazkaId,
    actorId,
    changes,
    detail,
    metadata,
  }: {
    zakazkaId: string;
    actorId?: string | null;
    changes: CriticalChangeType[];
    detail?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const uniqueChanges = [...new Set(changes)];
  if (uniqueChanges.length === 0) {
    return { ok: true, marked: false, reason: "no_changes" };
  }

  const { data: zakazka, error } = await supabase
    .from("zakazky")
    .select("workflow_stav, workflow_change_pending")
    .eq("zakazka_id", zakazkaId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!isApprovedOrLaterWorkflowStatus(zakazka?.workflow_stav)) {
    return { ok: true, marked: false, reason: "not_approved_yet" };
  }

  const labels = uniqueChanges.map(getCriticalChangeLabel);
  const summary = labels.join(", ");
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("zakazky")
    .update({
      workflow_change_pending: true,
      workflow_change_pending_at: now,
      workflow_change_pending_by: actorId ?? null,
      workflow_change_summary: summary,
    })
    .eq("zakazka_id", zakazkaId);

  if (updateError) return { ok: false, error: updateError.message };

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "workflow_critical_change",
    actorId: actorId ?? null,
    title: "Zakázka byla změněna po klientském schválení.",
    detail: detail ?? `Kritické změny: ${summary}. Vyžaduje nové potvrzení klientem.`,
    metadata: {
      changes: uniqueChanges,
      labels,
      previous_change_pending: Boolean(zakazka?.workflow_change_pending),
      ...(metadata ?? {}),
    },
  });

  return { ok: true, marked: true };
}

export async function clearZakazkaCriticalChangePending(
  supabase: any,
  {
    zakazkaId,
    actorId,
    source,
  }: {
    zakazkaId: string;
    actorId?: string | null;
    source: string;
  }
) {
  const { data: zakazka, error: loadError } = await supabase
    .from("zakazky")
    .select("workflow_change_pending, workflow_change_summary")
    .eq("zakazka_id", zakazkaId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!zakazka?.workflow_change_pending) return { ok: true, changed: false };

  const { error } = await supabase
    .from("zakazky")
    .update({
      workflow_change_pending: false,
      workflow_change_pending_at: null,
      workflow_change_pending_by: null,
      workflow_change_summary: null,
    })
    .eq("zakazka_id", zakazkaId);

  if (error) return { ok: false, error: error.message };

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "workflow_changes_approved",
    actorId: actorId ?? null,
    title: "Klient znovu potvrdil změny zakázky.",
    detail: zakazka.workflow_change_summary
      ? `Potvrzené změny: ${zakazka.workflow_change_summary}.`
      : null,
    metadata: { source },
  });

  return { ok: true, changed: true };
}
