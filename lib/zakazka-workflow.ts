import { logZakazkaHistory } from "@/lib/zakazka-history";

export type ZakazkaWorkflowStatus =
  | "navrh"
  | "cekani_na_schvaleni"
  | "schvaleno_klientem"
  | "priprava"
  | "v_realizaci"
  | "dokonceno"
  | "fakturovano"
  | "archiv";

export const WORKFLOW_STATUSES: ZakazkaWorkflowStatus[] = [
  "navrh",
  "cekani_na_schvaleni",
  "schvaleno_klientem",
  "priprava",
  "v_realizaci",
  "dokonceno",
  "fakturovano",
  "archiv",
];

export function normalizeWorkflowStatus(value?: string | null): ZakazkaWorkflowStatus {
  return WORKFLOW_STATUSES.includes(value as ZakazkaWorkflowStatus)
    ? (value as ZakazkaWorkflowStatus)
    : "navrh";
}

export function getWorkflowStatusLabel(value?: string | null) {
  const status = normalizeWorkflowStatus(value);
  if (status === "navrh") return "Návrh";
  if (status === "cekani_na_schvaleni") return "Čeká na schválení";
  if (status === "schvaleno_klientem") return "Schváleno klientem";
  if (status === "priprava") return "Příprava";
  if (status === "v_realizaci") return "V realizaci";
  if (status === "dokonceno") return "Dokončeno";
  if (status === "fakturovano") return "Fakturováno";
  return "Archiv";
}

export function getWorkflowBadgeClassName(value?: string | null) {
  const status = normalizeWorkflowStatus(value);
  if (status === "navrh") return "border-slate-500/40 bg-slate-500/15 text-slate-100";
  if (status === "cekani_na_schvaleni") return "border-amber-500/40 bg-amber-500/15 text-amber-100";
  if (status === "schvaleno_klientem") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";
  if (status === "priprava") return "border-blue-500/40 bg-blue-500/15 text-blue-100";
  if (status === "v_realizaci") return "border-cyan-500/40 bg-cyan-500/15 text-cyan-100";
  if (status === "dokonceno") return "border-purple-500/40 bg-purple-500/15 text-purple-100";
  if (status === "fakturovano") return "border-green-500/40 bg-green-500/15 text-green-100";
  return "border-zinc-500/40 bg-zinc-500/15 text-zinc-100";
}

const ALLOWED_WORKFLOW_TRANSITIONS: Record<ZakazkaWorkflowStatus, ZakazkaWorkflowStatus[]> = {
  navrh: ["cekani_na_schvaleni"],
  cekani_na_schvaleni: ["schvaleno_klientem"],
  schvaleno_klientem: ["priprava"],
  priprava: ["v_realizaci"],
  v_realizaci: ["dokonceno"],
  dokonceno: ["fakturovano"],
  fakturovano: ["archiv"],
  archiv: [],
};

function canChangeWorkflowStatus(
  previousStatus: ZakazkaWorkflowStatus,
  nextStatus: ZakazkaWorkflowStatus
) {
  return ALLOWED_WORKFLOW_TRANSITIONS[previousStatus].includes(nextStatus);
}

export async function setZakazkaWorkflowStatus(
  supabase: any,
  {
    zakazkaId,
    nextStatus,
    actorId,
    source,
    detail,
    metadata,
  }: {
    zakazkaId: string;
    nextStatus: ZakazkaWorkflowStatus;
    actorId?: string | null;
    source: string;
    detail?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { data: current, error: currentError } = await supabase
    .from("zakazky")
    .select("workflow_stav")
    .eq("zakazka_id", zakazkaId)
    .maybeSingle();

  if (currentError) return { ok: false, error: currentError.message };

  const previousStatus = normalizeWorkflowStatus(current?.workflow_stav);
  if (previousStatus === nextStatus) {
    return { ok: true, changed: false, previousStatus, nextStatus };
  }

  if (!canChangeWorkflowStatus(previousStatus, nextStatus)) {
    return {
      ok: false,
      error: `Nepovolený přechod workflow: ${getWorkflowStatusLabel(previousStatus)} → ${getWorkflowStatusLabel(nextStatus)}.`,
      changed: false,
      previousStatus,
      nextStatus,
    };
  }

  const timestamp = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("zakazky")
    .update({
      workflow_stav: nextStatus,
      workflow_changed_at: timestamp,
      workflow_changed_by: actorId ?? null,
    })
    .eq("zakazka_id", zakazkaId);

  if (updateError) return { ok: false, error: updateError.message };

  await logZakazkaHistory(supabase, {
    zakazkaId,
    eventType: "workflow_status_changed",
    actorId: actorId ?? null,
    title: `Workflow zakázky změněn na ${getWorkflowStatusLabel(nextStatus)}.`,
    detail:
      detail ??
      `Předchozí stav: ${getWorkflowStatusLabel(previousStatus)} → ${getWorkflowStatusLabel(nextStatus)}.`,
    metadata: {
      source,
      previous_status: previousStatus,
      next_status: nextStatus,
      ...(metadata ?? {}),
    },
  });

  return { ok: true, changed: true, previousStatus, nextStatus };
}
