"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Toast from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import type { TransportVehicleOption } from "@/lib/transport-attendance";
import type { TransportVehicleMode } from "@/lib/zakazka-attendance";
import {
  checkInTransportAttendanceAction,
  checkOutTransportAttendanceAction,
} from "./dochazka-actions";

type GpsInput = {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
};

type TransportAttendanceActionsProps = {
  zakazkaId: string;
  active: boolean;
  activeTransportMode?: TransportVehicleMode | null;
  companyVehicles: TransportVehicleOption[];
  privateVehicles: TransportVehicleOption[];
  disabled?: boolean;
  /** Bez vlastního rámečku — pro vložení do grid karty na /moje */
  embedded?: boolean;
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

export function TransportAttendanceActions({
  zakazkaId,
  active,
  activeTransportMode = null,
  companyVehicles,
  privateVehicles,
  disabled = false,
  embedded = false,
}: TransportAttendanceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [vehicleMode, setVehicleMode] = useState<TransportVehicleMode>("firemni");
  const [vozidloId, setVozidloId] = useState("");
  const [kmValue, setKmValue] = useState("");
  const [kmModalOpen, setKmModalOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [lastGps, setLastGps] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const vehicleOptions = useMemo(() => {
    if (active) {
      return activeTransportMode === "vlastni" ? privateVehicles : companyVehicles;
    }
    return vehicleMode === "vlastni" ? privateVehicles : companyVehicles;
  }, [active, activeTransportMode, companyVehicles, privateVehicles, vehicleMode]);

  const effectiveMode = active ? activeTransportMode : vehicleMode;

  function showResult(message: string, type: "success" | "error", warning?: string | null) {
    setLastGps(warning ?? null);
    setToast({ message: warning && type === "success" ? `${message} ${warning}.` : message, type });
  }

  function startTransport(reason?: string) {
    if (isPending || disabled || active) return;
    setError(null);
    startTransition(async () => {
      const { gps, warning } = await readGps();
      const result = await checkInTransportAttendanceAction({
        zakazkaId,
        gps,
        vehicleMode,
        vozidloId: vozidloId || null,
        overrideReason: reason ?? null,
      });

      if (!result.ok) {
        if (result.needsOverride) setOverrideOpen(true);
        setError(result.error);
        showResult(result.error, "error", result.warning ?? warning);
        return;
      }

      setOverrideOpen(false);
      setOverrideReason("");
      router.refresh();
      showResult("Přeprava byla zahájena.", "success", result.warning ?? warning);
    });
  }

  function finishTransport(km?: string) {
    if (isPending || disabled || !active) return;
    setError(null);
    startTransition(async () => {
      const { gps, warning } = await readGps();
      const result = await checkOutTransportAttendanceAction({
        zakazkaId,
        gps,
        km: km ?? null,
      });

      if (!result.ok) {
        setError(result.error);
        showResult(result.error, "error", result.warning ?? warning);
        return;
      }

      setKmModalOpen(false);
      setKmValue("");
      router.refresh();
      showResult("Přeprava byla ukončena.", "success", result.warning ?? warning);
    });
  }

  function requestStop() {
    if (activeTransportMode === "vlastni") {
      setKmModalOpen(true);
      return;
    }
    finishTransport();
  }

  function confirmKm() {
    const km = kmValue.trim();
    if (!km) {
      setError("Zadejte ujeté kilometry.");
      return;
    }
    finishTransport(km);
  }

  function confirmOverride() {
    const reason = overrideReason.trim();
    if (!reason) {
      setError("U override kolize je povinný důvod.");
      return;
    }
    startTransport(reason);
  }

  const panelClassName = embedded
    ? "flex flex-1 flex-col"
    : "rounded-2xl border border-slate-800 bg-slate-950/70 p-3";

  return (
    <>
      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}

      <div className={panelClassName}>
        {!embedded ? (
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Přeprava</div>
        ) : null}

        {!active ? (
          <div className="mb-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={vehicleMode === "firemni" ? "primary" : "secondary"}
                onClick={() => {
                  setVehicleMode("firemni");
                  setVozidloId("");
                }}
                disabled={isPending || disabled}
              >
                Firemní
              </Button>
              <Button
                type="button"
                variant={vehicleMode === "vlastni" ? "primary" : "secondary"}
                onClick={() => {
                  setVehicleMode("vlastni");
                  setVozidloId("");
                }}
                disabled={isPending || disabled}
              >
                Vlastní
              </Button>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vozidlo</span>
              <select
                value={vozidloId}
                onChange={(event) => setVozidloId(event.target.value)}
                disabled={isPending || disabled}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {vehicleMode === "vlastni" && privateVehicles.length === 0 ? (
                  <option value="">Vlastní vozidlo</option>
                ) : (
                  <option value="">
                    {vehicleMode === "vlastni" ? "Vlastní vozidlo (bez výběru)" : "Bez konkrétního vozidla"}
                  </option>
                )}
                {vehicleOptions.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="mb-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-100">
            Aktivní přeprava · {effectiveMode === "vlastni" ? "vlastní auto" : "firemní auto"}
            {effectiveMode === "vlastni" ? " · po ukončení zadejte km" : ""}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            onClick={() => startTransport()}
            disabled={isPending || disabled || active}
            className="min-h-14 text-base font-black"
          >
            {isPending && !active ? "Ukládám..." : active ? "Přeprava běží" : "Zahájit přepravu"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={requestStop}
            disabled={isPending || disabled || !active}
            className="min-h-14 text-base font-black"
          >
            {isPending && active ? "Ukládám..." : "Ukončit přepravu"}
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
        open={kmModalOpen}
        onClose={() => setKmModalOpen(false)}
        title="Kilometry (vlastní auto)"
        widthClassName="max-w-lg"
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-300">
            Po ukončení přepravy zadejte ujeté kilometry pro cestovní náhradu.
          </div>
          <Input
            type="text"
            inputMode="decimal"
            value={kmValue}
            onChange={(event) => setKmValue(event.target.value)}
            placeholder="např. 42,5"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={confirmKm} disabled={isPending}>
              Ukončit a odeslat km
            </Button>
            <Button type="button" variant="secondary" onClick={() => setKmModalOpen(false)} disabled={isPending}>
              Zavřít
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title="Kolize aktivní práce"
        widthClassName="max-w-lg"
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-300">
            Systém eviduje aktivní check-in na jiné zakázce. Pokud je to provozně správně, napište důvod
            override.
          </div>
          <Textarea
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            rows={4}
            placeholder="Např. předchozí práci jsem zapomněl ukončit..."
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
