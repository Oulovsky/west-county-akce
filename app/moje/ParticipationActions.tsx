"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Toast from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { acceptAssignmentAction, declineAssignmentAction } from "./actions";

type ParticipationActionsProps = {
  assignmentId: string;
  status: string;
};

export function ParticipationActions({ assignmentId, status }: ParticipationActionsProps) {
  const router = useRouter();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  function accept() {
    if (isPending || status === "accepted") return;
    setError(null);
    startTransition(async () => {
      try {
        await acceptAssignmentAction(assignmentId);
        router.refresh();
        setToast({ type: "success", message: "Účast byla potvrzena." });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Potvrzení se nepodařilo uložit.";
        setError(message);
        setToast({ type: "error", message });
      }
    });
  }

  function decline() {
    if (isPending) return;
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      setError("U odmítnutí je povinné uvést důvod.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await declineAssignmentAction(assignmentId, trimmedReason);
        setDeclineOpen(false);
        setReason("");
        router.refresh();
        setToast({ type: "success", message: "Odmítnutí bylo uloženo." });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Odmítnutí se nepodařilo uložit.";
        setError(message);
        setToast({ type: "error", message });
      }
    });
  }

  return (
    <>
      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={accept} disabled={isPending || status === "accepted"}>
          {isPending ? "Ukládám..." : status === "accepted" ? "Potvrzeno" : "Přijmout"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setError(null);
            setDeclineOpen(true);
          }}
          disabled={isPending || status === "declined"}
        >
          {status === "declined" ? "Odmítnuto" : "Odmítnout"}
        </Button>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <Modal
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Odmítnout účast"
        widthClassName="max-w-lg"
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-300">
            Napiš stručný důvod, proč se nemůžeš této fáze zúčastnit.
          </div>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Např. už jsem v práci na jiné akci."
            rows={4}
          />
          {error ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" onClick={decline} disabled={isPending}>
              {isPending ? "Ukládám..." : "Uložit odmítnutí"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeclineOpen(false)}
              disabled={isPending}
            >
              Zavřít
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
