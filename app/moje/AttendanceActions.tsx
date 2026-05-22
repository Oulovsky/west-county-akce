"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Toast from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { checkInAttendanceAction, checkOutAttendanceAction } from "./dochazka-actions";

type GpsInput = {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
};

type AttendanceActionsProps = {
  assignmentId: string;
  active: boolean;
  disabled?: boolean;
};

async function readGps(): Promise<{ gps: GpsInput; warning: string | null }> {
  if (!("geolocation" in navigator)) {
    return {
      gps: { lat: null, lng: null, accuracy: null },
      warning: "GPS nebyla dostupná",
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          gps: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          warning: null,
        });
      },
      () => {
        resolve({
          gps: { lat: null, lng: null, accuracy: null },
          warning: "GPS nebyla dostupná",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      }
    );
  });
}

export function AttendanceActions({ assignmentId, active, disabled = false }: AttendanceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [lastGps, setLastGps] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showResult(message: string, type: "success" | "error", warning?: string | null) {
    setLastGps(warning ?? null);
    setToast({ message: warning && type === "success" ? `${message} ${warning}.` : message, type });
  }

  function startWork(reason?: string) {
    if (isPending || disabled || active) return;
    setError(null);
    startTransition(async () => {
      const { gps, warning } = await readGps();
      const result = await checkInAttendanceAction({
        assignmentId,
        gps,
        overrideReason: reason ?? null,
      });

      if (!result.ok) {
        if (result.needsOverride) {
          setOverrideOpen(true);
        }
        setError(result.error);
        showResult(result.error, "error", result.warning ?? warning);
        return;
      }

      setOverrideOpen(false);
      setOverrideReason("");
      router.refresh();
      showResult("Práce byla zahájena.", "success", result.warning ?? warning);
    });
  }

  function stopWork() {
    if (isPending || disabled || !active) return;
    setError(null);
    startTransition(async () => {
      const { gps, warning } = await readGps();
      const result = await checkOutAttendanceAction({ assignmentId, gps });

      if (!result.ok) {
        setError(result.error);
        showResult(result.error, "error", result.warning ?? warning);
        return;
      }

      router.refresh();
      showResult("Práce byla ukončena.", "success", result.warning ?? warning);
    });
  }

  function confirmOverride() {
    const reason = overrideReason.trim();
    if (!reason) {
      setError("U override kolize je povinný důvod.");
      return;
    }
    startWork(reason);
  }

  return (
    <>
      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
          Reálný pracovní čas
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            onClick={() => startWork()}
            disabled={isPending || disabled || active}
            className="min-h-14 text-base font-black"
          >
            {isPending && !active ? "Ukládám..." : active ? "Práce běží" : "Zahájit práci"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={stopWork}
            disabled={isPending || disabled || !active}
            className="min-h-14 text-base font-black"
          >
            {isPending && active ? "Ukládám..." : "Ukončit práci"}
          </Button>
        </div>

        {lastGps ? (
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
            {lastGps}
          </div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100">
            {error}
          </div>
        ) : null}
      </div>

      <Modal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title="Kolize aktivní práce"
        widthClassName="max-w-lg"
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-300">
            Systém eviduje aktivní check-in na jiné zakázce. Pokud je to provozně správně,
            napište důvod override.
          </div>
          <Textarea
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            rows={4}
            placeholder="Např. předchozí práci jsem zapomněl ukončit, řeším souběžný přesun..."
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={confirmOverride} disabled={isPending}>
              Zahájit s override
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOverrideOpen(false)} disabled={isPending}>
              Zavřít
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
