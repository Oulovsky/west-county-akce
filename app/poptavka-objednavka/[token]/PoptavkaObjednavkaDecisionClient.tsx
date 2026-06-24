"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmPoptavkaObjednavkaAction,
  rejectPoptavkaObjednavkaAction,
} from "./actions";

type DoneStatus = "confirmed" | "already_confirmed" | "rejected" | "already_rejected";

const DONE_MESSAGES: Record<DoneStatus, string> = {
  confirmed:
    "Závazná objednávka byla potvrzena. Děkujeme, nyní ji interně zpracujeme.",
  already_confirmed: "Objednávka už byla potvrzena.",
  rejected: "Závazná objednávka byla odmítnuta. Důvod jsme uložili a ozveme se.",
  already_rejected: "Objednávka už byla odmítnuta.",
};

export function PoptavkaObjednavkaDecisionClient({ token }: { token: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [doneStatus, setDoneStatus] = useState<DoneStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function finish(status: DoneStatus) {
    setDoneStatus(status);
    router.refresh();
  }

  function confirm() {
    if (isPending) return;

    if (
      !window.confirm(
        "Potvrzením souhlasíte se závaznou objednávkou v uvedeném rozsahu. Pokračovat?"
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await confirmPoptavkaObjednavkaAction(token);
      if (!result.ok) {
        setError(result.errorMessage);
        return;
      }

      finish(
        result.status === "already_confirmed" ? "already_confirmed" : "confirmed"
      );
    });
  }

  function reject() {
    if (isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await rejectPoptavkaObjednavkaAction(token, reason);
      if (!result.ok) {
        setError(result.errorMessage);
        return;
      }

      finish(result.status === "already_rejected" ? "already_rejected" : "rejected");
    });
  }

  if (doneStatus) {
    const tone =
      doneStatus === "confirmed" || doneStatus === "already_confirmed"
        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
        : "border-amber-500/40 bg-amber-950/30 text-amber-100";

    return (
      <div className={`rounded-2xl border px-4 py-4 text-sm ${tone}`}>
        <p className="font-semibold">{DONE_MESSAGES[doneStatus]}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
      <div>
        <h2 className="text-lg font-bold text-white">Rozhodnutí o závazné objednávce</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          Potvrzením závazné objednávky souhlasíte s uvedeným rozsahem služeb a smluvními
          podmínkami v dokumentu výše. Pokud něco nesedí, objednávku můžete odmítnout.
        </p>
      </div>

      {mode === "reject" ? (
        <div>
          <label className="text-sm font-semibold text-slate-200" htmlFor="odmitnuti-duvod">
            Důvod odmítnutí
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Důvod je volitelný, ale doporučujeme ho uvést — usnadní to další komunikaci.
          </p>
          <Textarea
            id="odmitnuti-duvod"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="Napište prosím, co je potřeba upravit nebo proč objednávku odmítáte."
            className="mt-2"
          />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={confirm} disabled={isPending}>
          {isPending && mode === "idle" ? "Ukládám…" : "Potvrdit závaznou objednávku"}
        </Button>
        {mode === "reject" ? (
          <>
            <Button type="button" variant="danger" onClick={reject} disabled={isPending}>
              {isPending ? "Ukládám…" : "Odeslat odmítnutí"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode("idle")}
              disabled={isPending}
            >
              Zpět
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMode("reject")}
            disabled={isPending}
          >
            Odmítnout závaznou objednávku
          </Button>
        )}
      </div>
    </div>
  );
}
