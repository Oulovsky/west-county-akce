"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitClientApprovalDecisionAction } from "./actions";

export function ApprovalDecisionClient({ token }: { token: string }) {
  const [mode, setMode] = useState<"idle" | "decline" | "done">("idle");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(decision: "approve" | "decline") {
    if (isPending) return;
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const result = await submitClientApprovalDecisionAction(token, decision, reason);
        if (!result.ok) {
          setError(result.errorMessage);
          return;
        }

        setMode("done");
        setMessage(
          decision === "approve"
            ? "Děkujeme, zakázka byla schválena."
            : "Děkujeme, odmítnutí jsme uložili a ozveme se kvůli úpravám."
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Uložení rozhodnutí selhalo.");
      }
    });
  }

  if (mode === "done") {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-4 text-sm font-semibold text-emerald-100">
        {message}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <div>
        <div className="text-lg font-bold text-white">Rozhodnutí klienta</div>
        <p className="mt-1 text-sm text-slate-400">
          Schválením potvrzujete finální podobu zakázky. Fakturace bude řešena samostatně.
        </p>
      </div>

      {mode === "decline" ? (
        <div>
          <label className="text-sm font-semibold text-slate-200">Důvod odmítnutí</label>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="Napište prosím, co je potřeba upravit."
          />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" onClick={() => submit("approve")} disabled={isPending}>
          {isPending ? "Ukládám..." : "Schválit zakázku"}
        </Button>
        {mode === "decline" ? (
          <Button type="button" variant="danger" onClick={() => submit("decline")} disabled={isPending}>
            {isPending ? "Ukládám..." : "Odeslat odmítnutí"}
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setMode("decline")} disabled={isPending}>
            Odmítnout zakázku
          </Button>
        )}
      </div>
    </div>
  );
}
