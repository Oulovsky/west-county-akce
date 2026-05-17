"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { runReminderEngineAction } from "./actions";
import {
  initialReminderEngineActionState,
  type ReminderEngineActionState,
} from "./state";

function SubmitButton({ hasResult }: { hasResult: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Spouštím kontroly…" : hasResult ? "Spustit kontroly znovu" : "Spustit kontroly"}
    </button>
  );
}

function ResultPanel({ state }: { state: ReminderEngineActionState }) {
  if (state.error) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
        <div className="font-black">Kontroly selhaly</div>
        <div className="mt-1">{state.error}</div>
      </div>
    );
  }

  if (!state.ok || !state.result) return null;

  const { notifications } = state.result;
  return (
    <div className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
      <div className="font-black">Kontroly doběhly</div>
      <div>
        Vytvořeno: <strong>{notifications.created}</strong> · Přeskočeno:{" "}
        <strong>{notifications.skipped}</strong> · Chyby: <strong>{notifications.failed}</strong>
      </div>
      <div className="text-xs text-emerald-100/80">
        Kontroly: zítřejší akce {state.result.tomorrowEvents}, odjezdy {state.result.departureSoon},
        neukončená docházka {state.result.openAttendance}, proplacení {state.result.unpaidWork},
        změny/schválení {state.result.pendingApprovals + state.result.clientApprovals}, servis{" "}
        {state.result.longRepairs}, faktury po splatnosti {state.result.overdueInvoices}.
      </div>
    </div>
  );
}

export function ReminderRunClient() {
  const router = useRouter();
  const [state, formAction] = useActionState(
    runReminderEngineAction,
    initialReminderEngineActionState
  );

  useEffect(() => {
    if (state.runId && state.ok) {
      router.refresh();
    }
  }, [router, state.ok, state.runId]);

  return (
    <form action={formAction} className="space-y-4">
      <SubmitButton hasResult={Boolean(state.runId)} />
      <ResultPanel state={state} />
    </form>
  );
}
