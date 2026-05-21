"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import jsQR from "jsqr";
import { extractSkladKusIdFromInput } from "@/lib/sklad/kusLabels";

type CameraStatus = "idle" | "starting" | "scanning" | "error";
type WorkflowMode = "loading" | "unloading";
type ViewMode = "okruhy" | "polozky" | "scan";
type ChecklistStatus = "hotovo" | "rozpracovano" | "nenalozeno";

export type MovementScanResult =
  | {
      ok: true;
      action: "nalozeno" | "vraceno" | "poskozeno";
      message: string;
      kus: {
        kusId: string;
        itemName: string;
        poradoveCislo: number | string;
        pozice: number | string | null;
      };
      counts: {
        plan?: number;
        loaded: number;
        reserve?: number;
        returned?: number;
        remaining: number;
      };
      replacementFor?: string | null;
    }
  | {
      ok: false;
      requiresDecision: true;
      decision:
        | "loading-damaged"
        | "loading-capacity"
        | "loading-replacement"
        | "unloading-damaged";
      warning: string;
      kus: {
        kusId: string;
        itemName: string;
        poradoveCislo: number | string;
        pozice: number | string | null;
      };
      damageNote?: string | null;
      plannedItemName?: string | null;
    }
  | {
      ok: false;
      requiresDecision?: false;
      error: string;
    };

export type LoadingChecklistItem = {
  skladovaPolozkaId: string;
  nazev: string;
  plan: number;
  loaded: number;
  reserve: number;
  remaining: number;
  pozice: number | string | null;
  okruhId: string;
  okruhNazev: string;
  okruhPoradi: number;
  status: ChecklistStatus;
  replacementNote?: string | null;
};

export type LoadingOkruh = {
  okruhId: string;
  nazev: string;
  poradi: number;
  plan: number;
  loaded: number;
  reserve: number;
  remaining: number;
  items: LoadingChecklistItem[];
};

export type UnloadingChecklistItem = {
  skladovaPolozkaId: string;
  nazev: string;
  loaded: number;
  returned: number;
  remaining: number;
  pozice: number | string | null;
  okruhId: string;
  okruhNazev: string;
  okruhPoradi: number;
  status: ChecklistStatus;
};

export type UnloadingOkruh = {
  okruhId: string;
  nazev: string;
  poradi: number;
  loaded: number;
  returned: number;
  remaining: number;
  items: UnloadingChecklistItem[];
};

type ChecklistItem = LoadingChecklistItem | UnloadingChecklistItem;
type ChecklistOkruh = LoadingOkruh | UnloadingOkruh;

type Props = {
  initialLoadingOkruhy: LoadingOkruh[];
  initialUnloadingOkruhy: UnloadingOkruh[];
  openScanOnMobile?: boolean;
  processLoadingScanAction: (
    input: string,
    expectedSkladovaPolozkaId: string,
    decision?: ScanDecision,
    overrideReason?: string
  ) => Promise<MovementScanResult>;
  processUnloadingScanAction: (
    input: string,
    expectedSkladovaPolozkaId: string,
    decision?: ScanDecision,
    overrideReason?: string
  ) => Promise<MovementScanResult>;
};

type ScanDecision =
  | "force_damaged_load"
  | "force_capacity_load"
  | "use_replacement"
  | "return_to_stock"
  | "set_aside_damaged"
  | "load_reserve";

function positionText(value: number | string | null | undefined) {
  const text = String(value ?? "").trim();
  return text ? `Pozice ${text}` : "Pozice —";
}

function statusLabel(status: ChecklistStatus, workflowMode: WorkflowMode) {
  if (status === "hotovo") return workflowMode === "unloading" ? "Vráceno" : "Hotovo";
  if (status === "rozpracovano") return "Rozpracováno";
  return workflowMode === "unloading" ? "Nevráceno" : "Nenaloženo";
}

function statusClass(status: ChecklistStatus) {
  if (status === "hotovo") return "border-emerald-700 bg-emerald-950 text-emerald-100";
  if (status === "rozpracovano") return "border-amber-700 bg-amber-950 text-amber-100";
  return "border-slate-700 bg-slate-950 text-slate-200";
}

function isLoadingItem(item: ChecklistItem): item is LoadingChecklistItem {
  return "plan" in item;
}

export function ZakazkaLoadingScanClient({
  initialLoadingOkruhy,
  initialUnloadingOkruhy,
  openScanOnMobile = false,
  processLoadingScanAction,
  processUnloadingScanAction,
}: Props) {
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("loading");
  const [loadingOkruhy, setLoadingOkruhy] = useState(initialLoadingOkruhy);
  const [unloadingOkruhy, setUnloadingOkruhy] = useState(initialUnloadingOkruhy);
  const [viewMode, setViewMode] = useState<ViewMode>("okruhy");
  const [selectedOkruhId, setSelectedOkruhId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [reserveMode, setReserveMode] = useState(false);
  const [value, setValue] = useState("");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState("Kamera není spuštěná.");
  const [result, setResult] = useState<MovementScanResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const successCanAutoResumeRef = useRef(false);

  useEffect(() => {
    if (!openScanOnMobile) return;
    const media = window.matchMedia("(max-width: 1023px)");
    if (!media.matches) return;
    setViewMode("scan");
  }, [openScanOnMobile]);

  const currentOkruhy: ChecklistOkruh[] =
    workflowMode === "loading" ? loadingOkruhy : unloadingOkruhy;

  const selectedOkruh = useMemo(
    () => currentOkruhy.find((okruh) => okruh.okruhId === selectedOkruhId) ?? null,
    [currentOkruhy, selectedOkruhId]
  );

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    const items: ChecklistItem[] = [];
    for (const okruh of currentOkruhy) {
      items.push(...(okruh.items as ChecklistItem[]));
    }
    return items.find((item) => item.skladovaPolozkaId === selectedItemId) ?? null;
  }, [currentOkruhy, selectedItemId]);

  const previewKusId = useMemo(
    () =>
      extractSkladKusIdFromInput(
        value,
        typeof window === "undefined" ? "http://localhost" : window.location.origin
      ),
    [value]
  );

  const stopCamera = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  function resetNavigation(nextWorkflowMode = workflowMode) {
    stopCamera();
    processingRef.current = false;
    setWorkflowMode(nextWorkflowMode);
    setViewMode("okruhy");
    setSelectedOkruhId(null);
    setSelectedItemId(null);
    setReserveMode(false);
    setResult(null);
    setValue("");
    setScanMessage("Kamera není spuštěná.");
    setCameraStatus("idle");
  }

  function updateLoadingCounts(
    itemId: string,
    loaded: number,
    plan: number,
    reserve = 0,
    replacementFor?: string | null
  ) {
    setLoadingOkruhy((current) =>
      current.map((okruh) => {
        const items = okruh.items.map((item) => {
          if (item.skladovaPolozkaId !== itemId) return item;

          const nextLoaded = replacementFor ? item.loaded + 1 : loaded;
          const nextReserve = reserve;
          const regularLoaded = Math.max(nextLoaded - nextReserve, 0);
          const remaining = Math.max(plan - regularLoaded, 0);
          const status: ChecklistStatus =
            remaining <= 0 ? "hotovo" : nextLoaded > 0 ? "rozpracovano" : "nenalozeno";

          return {
            ...item,
            plan,
            loaded: nextLoaded,
            reserve: nextReserve,
            remaining,
            status,
            replacementNote: replacementFor
              ? `Splněno náhradou za: ${replacementFor}`
              : item.replacementNote ?? null,
          };
        });

        const nextPlan = items.reduce((sum, item) => sum + item.plan, 0);
        const nextLoaded = items.reduce((sum, item) => sum + item.loaded, 0);
        const nextReserve = items.reduce((sum, item) => sum + item.reserve, 0);
        return {
          ...okruh,
          items,
          plan: nextPlan,
          loaded: nextLoaded,
          reserve: nextReserve,
          remaining: items.reduce((sum, item) => sum + item.remaining, 0),
        };
      })
    );
  }

  function updateUnloadingCounts(
    itemId: string,
    loaded: number,
    returned: number,
    remaining: number
  ) {
    setUnloadingOkruhy((current) =>
      current.map((okruh) => {
        const items = okruh.items.map((item) => {
          if (item.skladovaPolozkaId !== itemId) return item;

          const status: ChecklistStatus =
            remaining <= 0 ? "hotovo" : returned > 0 ? "rozpracovano" : "nenalozeno";

          return { ...item, loaded, returned, remaining, status };
        });

        return {
          ...okruh,
          items,
          loaded: items.reduce((sum, item) => sum + item.loaded, 0),
          returned: items.reduce((sum, item) => sum + item.returned, 0),
          remaining: items.reduce((sum, item) => sum + item.remaining, 0),
        };
      })
    );
  }

  function openOkruh(okruhId: string) {
    stopCamera();
    processingRef.current = false;
    setSelectedOkruhId(okruhId);
    setSelectedItemId(null);
    setReserveMode(false);
    setResult(null);
    setViewMode("polozky");
    setScanMessage("Kamera není spuštěná.");
  }

  function openItem(itemId: string) {
    stopCamera();
    processingRef.current = false;
    setSelectedItemId(itemId);
    setReserveMode(false);
    setResult(null);
    setValue("");
    setViewMode("scan");
    setScanMessage("Kamera není spuštěná.");
  }

  const processPayload = useCallback(
    (payload: string, decision?: ScanDecision, overrideReason?: string) => {
      if (!selectedItem) {
        successCanAutoResumeRef.current = false;
        setResult({ ok: false, error: "Nejdřív vyber položku checklistu." });
        return;
      }

      if (processingRef.current) return;
      processingRef.current = true;
      successCanAutoResumeRef.current = false;
      setResult(null);
      setScanMessage(
        workflowMode === "loading"
          ? "QR načteno, ověřuji položku a plán zakázky…"
          : "QR načteno, ověřuji naložený kus…"
      );

      startTransition(async () => {
        const action =
          workflowMode === "loading"
            ? processLoadingScanAction
            : processUnloadingScanAction;
        const effectiveDecision =
          decision ?? (workflowMode === "loading" && reserveMode ? "load_reserve" : undefined);
        const next = await action(
          payload,
          selectedItem.skladovaPolozkaId,
          effectiveDecision,
          overrideReason
        );
        setResult(next);

        if (next.ok) {
          successCanAutoResumeRef.current =
            !effectiveDecision && next.counts.remaining > 0;

          if (workflowMode === "loading") {
            updateLoadingCounts(
              selectedItem.skladovaPolozkaId,
              next.counts.loaded,
              next.counts.plan ?? 0,
              next.counts.reserve ?? 0,
              next.replacementFor
            );
            setScanMessage(next.counts.reserve ? "Rezerva naložena." : "Naloženo.");
          } else {
            updateUnloadingCounts(
              selectedItem.skladovaPolozkaId,
              next.counts.loaded,
              next.counts.returned ?? 0,
              next.counts.remaining
            );
            setScanMessage("Vráceno.");
          }

          processingRef.current = false;
          setValue("");
        } else if (next.requiresDecision) {
          successCanAutoResumeRef.current = false;
          setScanMessage("Vyžaduje rozhodnutí.");
          processingRef.current = false;
        } else {
          successCanAutoResumeRef.current = false;
          setScanMessage("Scan odmítnut.");
          processingRef.current = false;
        }
      });
    },
    [processLoadingScanAction, processUnloadingScanAction, reserveMode, selectedItem, workflowMode]
  );

  const scanFrame = useCallback(() => {
    frameRef.current = null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || processingRef.current) return;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, width, height, {
            inversionAttempts: "attemptBoth",
          });

          if (code?.data) {
            processPayload(code.data);
            return;
          }
        }
      }
    }

    setScanMessage("Hledám QR kód…");
    frameRef.current = window.requestAnimationFrame(scanFrame);
  }, [processPayload]);

  useEffect(() => {
    if (!result?.ok) return;
    if (!successCanAutoResumeRef.current) return;
    if (cameraStatus !== "scanning") return;
    if (reserveMode) return;
    if (result.counts.remaining <= 0) return;

    setScanMessage(`${result.message}. Připraveno na další scan…`);

    resumeTimerRef.current = window.setTimeout(() => {
      resumeTimerRef.current = null;
      if (processingRef.current || frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(scanFrame);
    }, 500);

    return () => {
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };
  }, [cameraStatus, reserveMode, result, scanFrame]);

  const startCamera = useCallback(async () => {
    setResult(null);
    setCameraMessage(null);
    setScanMessage("Spouštím kameru…");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("error");
      setCameraMessage("Kamera není v tomto prohlížeči dostupná.");
      setScanMessage("Použij ruční vstup níže.");
      return;
    }

    try {
      setCameraStatus("starting");
      processingRef.current = false;
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (!videoRef.current) {
        stopCamera();
        setCameraStatus("error");
        setCameraMessage("Video náhled se nepodařilo připravit.");
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setCameraStatus("scanning");
      setScanMessage("Hledám QR kód…");
      frameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (err) {
      stopCamera();
      setCameraStatus("error");
      setScanMessage("Použij ruční vstup níže.");
      processingRef.current = false;

      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setCameraMessage("Kamera není povolená. Povol přístup ke kameře v prohlížeči.");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setCameraMessage("Na zařízení nebyla nalezena kamera.");
      } else {
        setCameraMessage("Kameru se nepodařilo spustit. Zkus ruční vstup.");
      }
    }
  }, [scanFrame, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    processingRef.current = false;
    processPayload(value);
  }

  function confirmDecision(decision: ScanDecision) {
    let overrideReason: string | undefined;
    if (
      decision === "force_damaged_load" ||
      decision === "force_capacity_load" ||
      (decision === "use_replacement" && result?.ok === false && "damageNote" in result && result.damageNote)
    ) {
      const reason = window.prompt(
        decision === "force_capacity_load"
          ? "Důvod override kapacitní kolize:"
          : "Důvod override pro naložení problémového kusu:"
      );
      if (!reason?.trim()) {
        setResult({ ok: false, error: "U override je povinný důvod." });
        return;
      }
      overrideReason = reason.trim();
    }
    processingRef.current = false;
    processPayload(value, decision, overrideReason);
  }

  const emptyTitle =
    workflowMode === "loading" ? "Nakládka je prázdná" : "Vykládka je prázdná";
  const emptyText =
    workflowMode === "loading"
      ? "Zakázka zatím nemá plánované položky v technice."
      : "Zakázka zatím nemá žádné fyzicky naložené kusy.";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-2xl border border-slate-800 bg-slate-950 p-1">
        {(["loading", "unloading"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => resetNavigation(mode)}
            className={[
              "rounded-xl px-4 py-3 text-sm font-black transition",
              workflowMode === mode
                ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                : "text-slate-400 hover:bg-slate-900 hover:text-white",
            ].join(" ")}
          >
            {mode === "loading" ? "Nakládka" : "Vykládka"}
          </button>
        ))}
      </div>

      {currentOkruhy.length === 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-slate-200">
          <h2 className="text-xl font-black text-white">{emptyTitle}</h2>
          <p className="mt-2 text-sm text-slate-400">{emptyText}</p>
        </section>
      ) : null}

      {currentOkruhy.length > 0 && viewMode !== "okruhy" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => resetNavigation()}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            Okruhy
          </button>
          {selectedOkruh ? (
            <button
              type="button"
              onClick={() => {
                stopCamera();
                processingRef.current = false;
                setViewMode("polozky");
                setSelectedItemId(null);
                setResult(null);
              }}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              {selectedOkruh.nazev}
            </button>
          ) : null}
        </div>
      ) : null}

      {currentOkruhy.length > 0 && viewMode === "okruhy" ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-black text-white">
              {workflowMode === "loading" ? "Okruhy nakládky" : "Okruhy vykládky"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {workflowMode === "loading"
                ? "Postupuj podle fyzického vrstvení techniky ve skladu a v autě."
                : "Vracej jen kusy, které jsou na této zakázce skutečně naložené."}
            </p>
          </div>

          {currentOkruhy.map((okruh) => {
            const done = okruh.remaining <= 0;
            return (
              <button
                key={okruh.okruhId}
                type="button"
                onClick={() => openOkruh(okruh.okruhId)}
                className={[
                  "block w-full rounded-2xl border p-5 text-left shadow-lg shadow-black/20 transition hover:border-blue-500",
                  done
                    ? "border-emerald-800 bg-emerald-950/50"
                    : "border-slate-800 bg-slate-900/70",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Okruh
                    </div>
                    <div className="mt-1 truncate text-2xl font-black text-white">
                      {okruh.nazev}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-right">
                    <div className="text-xs text-slate-400">
                      {workflowMode === "loading" ? "Zbývá" : "Vrátit"}
                    </div>
                    <div className="text-3xl font-black text-white">{okruh.remaining}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500">
                      {workflowMode === "loading" ? "Plán" : "Naloženo"}
                    </div>
                    <div className="text-xl font-black text-white">
                      {workflowMode === "loading"
                        ? (okruh as LoadingOkruh).plan
                        : (okruh as UnloadingOkruh).loaded}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500">
                      {workflowMode === "loading" ? "Naskenováno" : "Vráceno"}
                    </div>
                    <div className="text-xl font-black text-white">
                      {workflowMode === "loading"
                        ? (okruh as LoadingOkruh).loaded
                        : (okruh as UnloadingOkruh).returned}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                    <div className="text-xs text-slate-500">
                      {workflowMode === "loading" ? "Rezerva" : "Položky"}
                    </div>
                    <div className="text-xl font-black text-white">
                      {workflowMode === "loading"
                        ? (okruh as LoadingOkruh).reserve
                        : okruh.items.length}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      ) : null}

      {viewMode === "polozky" && selectedOkruh ? (
        <section className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {workflowMode === "loading" ? "Checklist nakládky" : "Checklist vykládky"}
            </div>
            <h2 className="mt-1 text-3xl font-black text-white">{selectedOkruh.nazev}</h2>
          </div>

          {selectedOkruh.items.map((item) => (
            <button
              key={item.skladovaPolozkaId}
              type="button"
              onClick={() => openItem(item.skladovaPolozkaId)}
              className={[
                "block w-full rounded-2xl border p-5 text-left shadow-lg shadow-black/20 transition hover:border-blue-500",
                statusClass(item.status),
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    {statusLabel(item.status, workflowMode)}
                  </div>
                  <div className="mt-1 text-2xl font-black leading-tight text-white">
                    {item.nazev}
                  </div>
                  {isLoadingItem(item) && item.replacementNote ? (
                    <div className="mt-2 rounded-xl border border-blue-700 bg-blue-950 px-3 py-2 text-sm font-bold text-blue-100">
                      {item.replacementNote}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-right">
                  <div className="text-xs text-slate-400">Pozice</div>
                  <div className="text-3xl font-black text-white">
                    {positionText(item.pozice).replace("Pozice ", "")}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                {isLoadingItem(item) ? (
                  <>
                    <CountBox label="Plán" value={item.plan} />
                    <CountBox label="Naskenováno" value={item.loaded} />
                    <CountBox label="Rezerva" value={item.reserve} />
                    <CountBox label="Zbývá" value={item.remaining} />
                  </>
                ) : (
                  <>
                    <CountBox label="Naloženo" value={item.loaded} />
                    <CountBox label="Vráceno" value={item.returned} />
                    <CountBox label="Zbývá vrátit" value={item.remaining} />
                  </>
                )}
              </div>
            </button>
          ))}
        </section>
      ) : null}

      {viewMode === "scan" && selectedItem ? (
        <>
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {workflowMode === "loading" ? "Scan nakládky" : "Scan vykládky"}
                </div>
                <h2 className="mt-1 text-2xl font-black text-white">{selectedItem.nazev}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {workflowMode === "loading"
                    ? "Přijímá jen kusy této skladové položky."
                    : "Vrací jen kusy této položky, které jsou naložené na této zakázce."}
                </p>
              </div>
              <div className="flex gap-2">
                {cameraStatus === "scanning" ? (
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      processingRef.current = false;
                      setCameraStatus("idle");
                      setScanMessage("Kamera zastavená.");
                    }}
                    className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
                  >
                    Zastavit
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  disabled={
                    cameraStatus === "starting" ||
                    isPending ||
                    (isLoadingItem(selectedItem) && selectedItem.remaining <= 0 && !reserveMode)
                  }
                  className="rounded-xl border border-emerald-600 bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cameraStatus === "starting"
                    ? "Spouštím…"
                    : workflowMode === "loading"
                      ? "Spustit loading scan"
                      : "Spustit unloading scan"}
                </button>
              </div>
            </div>

            {isLoadingItem(selectedItem) && selectedItem.remaining <= 0 && !reserveMode ? (
              <div className="mt-4 rounded-2xl border border-emerald-700 bg-emerald-950/70 p-4">
                <div className="text-2xl font-black text-white">
                  Hotovo {selectedItem.loaded}/{selectedItem.plan}
                </div>
                <div className="mt-1 text-sm font-semibold text-emerald-200">
                  Rezerva: {selectedItem.reserve}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      processingRef.current = false;
                      setReserveMode(false);
                      setResult(null);
                      setValue("");
                      setViewMode("polozky");
                      setScanMessage("Kamera není spuštěná.");
                    }}
                    className="min-h-16 rounded-2xl border border-emerald-500 bg-emerald-600 px-5 py-4 text-lg font-black text-white shadow-lg shadow-emerald-950/40"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReserveMode(true);
                      setResult(null);
                      setScanMessage("Režim rezervy: naskenuj další kus stejné položky.");
                    }}
                    className="min-h-16 rounded-2xl border border-blue-500 bg-blue-600 px-5 py-4 text-lg font-black text-white shadow-lg shadow-blue-950/40"
                  >
                    Naložit rezervu
                  </button>
                </div>
              </div>
            ) : null}

            {reserveMode && isLoadingItem(selectedItem) ? (
              <div className="mt-4 rounded-2xl border-2 border-blue-400 bg-blue-950 p-4 text-base font-black uppercase tracking-wide text-blue-50 shadow-2xl shadow-blue-950/50">
                REŽIM REZERVY – další kus bude uložen jako rezerva nad plán
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border-2 border-blue-500 bg-blue-950/70 p-5 shadow-2xl shadow-blue-950/40">
              <div className="text-sm font-black uppercase tracking-wide text-blue-200">
                Aktuální úkol
              </div>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                    {workflowMode === "loading" ? "Nakládka" : "Vykládka"}
                  </div>
                  <div className="mt-1 text-3xl font-black leading-tight text-white">
                    {selectedItem.nazev}
                  </div>
                </div>
                <div className="shrink-0 rounded-xl border border-blue-400 bg-blue-900/70 px-4 py-3 text-center">
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                    Skladová pozice
                  </div>
                  <div className="text-3xl font-black text-white">
                    {positionText(selectedItem.pozice).replace("Pozice ", "")}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <CountBox
                  label="Plán"
                  value={isLoadingItem(selectedItem) ? selectedItem.plan : selectedItem.loaded}
                />
                <CountBox
                  label="Naskenováno"
                  value={isLoadingItem(selectedItem) ? selectedItem.loaded : selectedItem.returned}
                />
                <CountBox
                  label="Rezerva"
                  value={isLoadingItem(selectedItem) ? selectedItem.reserve : 0}
                />
                <CountBox label="Zbývá" value={selectedItem.remaining} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {isLoadingItem(selectedItem) ? (
                <>
                  <CountBox label="Plán" value={selectedItem.plan} />
                  <CountBox label="Naskenováno" value={selectedItem.loaded} />
                  <CountBox label="Rezerva" value={selectedItem.reserve} />
                  <CountBox label="Zbývá" value={selectedItem.remaining} />
                </>
              ) : (
                <>
                  <CountBox label="Naloženo" value={selectedItem.loaded} />
                  <CountBox label="Vráceno" value={selectedItem.returned} />
                </>
              )}
            </div>

            <div className="mt-2 rounded-xl border border-emerald-700 bg-emerald-950 p-3 text-center">
              <div className="text-xs text-emerald-300">Pozice</div>
              <div className="text-3xl font-black text-white">
                {positionText(selectedItem.pozice).replace("Pozice ", "")}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              <video
                ref={videoRef}
                className={[
                  "aspect-[3/4] w-full object-cover sm:aspect-video",
                  cameraStatus === "scanning" || cameraStatus === "starting" ? "block" : "hidden",
                ].join(" ")}
                muted
                playsInline
                autoPlay
              />
              {cameraStatus !== "scanning" && cameraStatus !== "starting" ? (
                <div className="flex min-h-64 items-center justify-center px-6 py-10 text-center text-sm text-slate-500">
                  Kamera zatím neběží. Spusť scan, nebo použij ruční vstup.
                </div>
              ) : null}
            </div>

            <canvas ref={canvasRef} className="hidden" aria-hidden />

            <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
              {scanMessage}
            </div>

            {cameraMessage ? (
              <div className="mt-3 rounded-xl border border-amber-900 bg-amber-950/50 px-3 py-2 text-sm text-amber-100">
                {cameraMessage}
              </div>
            ) : null}
          </section>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
          >
            <label htmlFor="movement-scan-input" className="block text-sm font-semibold text-white">
              Ruční fallback: URL štítku nebo kus_id
            </label>
            <textarea
              id="movement-scan-input"
              value={value}
              onChange={(event) => {
                processingRef.current = false;
                setValue(event.target.value);
                setResult(null);
              }}
              placeholder="https://example.cz/sklad/kus/... nebo samotné kus_id"
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />

            {previewKusId ? (
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                Rozpoznaný kus: <code className="font-semibold text-slate-100">{previewKusId}</code>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                isPending ||
                (isLoadingItem(selectedItem) && selectedItem.remaining <= 0 && !reserveMode)
              }
              className="mt-4 flex w-full items-center justify-center rounded-2xl border border-blue-600 bg-blue-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending
                ? "Ověřuji…"
                : workflowMode === "loading"
                  ? "Naložit kus"
                  : "Vrátit kus"}
            </button>
          </form>

          {result && !result.ok && result.requiresDecision ? (
            <section className="rounded-2xl border-2 border-amber-500 bg-amber-950/80 p-5 text-amber-50 shadow-2xl shadow-amber-950/40">
              <div className="text-sm font-black uppercase tracking-wide text-amber-200">
                Vyžaduje rozhodnutí
              </div>
              <div className="mt-2 text-3xl font-black text-white">
                {result.kus.itemName}
              </div>
              <div className="mt-2 text-xl font-black text-amber-100">
                Kus #{result.kus.poradoveCislo} · {positionText(result.kus.pozice)}
              </div>
              <div className="mt-4 rounded-2xl border border-amber-400 bg-amber-900/60 p-4 text-base font-bold">
                {result.warning}
              </div>
              {result.damageNote ? (
                <div className="mt-3 rounded-2xl border border-red-500 bg-red-950/70 p-4 text-sm font-semibold text-red-100">
                  {result.damageNote}
                </div>
              ) : null}
              {result.plannedItemName ? (
                <div className="mt-3 rounded-2xl border border-blue-500 bg-blue-950/70 p-4 text-sm font-semibold text-blue-100">
                  Plánovaná položka: {result.plannedItemName}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3">
                {result.decision === "loading-damaged" ? (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => confirmDecision("force_damaged_load")}
                      className="min-h-16 rounded-2xl border border-red-500 bg-red-600 px-5 py-4 text-lg font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
                    >
                      Přesto naložit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setValue("");
                        setScanMessage("Čekám na jiný kus…");
                      }}
                      className="min-h-16 rounded-2xl border border-slate-600 bg-slate-800 px-5 py-4 text-lg font-black text-white"
                    >
                      Vrátit a nahradit
                    </button>
                  </>
                ) : null}

                {result.decision === "loading-replacement" ? (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => confirmDecision("use_replacement")}
                      className="min-h-16 rounded-2xl border border-blue-500 bg-blue-600 px-5 py-4 text-lg font-black text-white shadow-lg shadow-blue-950/40 disabled:opacity-60"
                    >
                      Použít jako náhradu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setValue("");
                        setScanMessage("Scan zrušen. Čekám na další kus…");
                      }}
                      className="min-h-16 rounded-2xl border border-slate-600 bg-slate-800 px-5 py-4 text-lg font-black text-white"
                    >
                      Zrušit scan
                    </button>
                  </>
                ) : null}

                {result.decision === "loading-capacity" ? (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => confirmDecision("force_capacity_load")}
                      className="min-h-16 rounded-2xl border border-amber-500 bg-amber-600 px-5 py-4 text-lg font-black text-white shadow-lg shadow-amber-950/40 disabled:opacity-60"
                    >
                      Přesto naložit s důvodem
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setResult(null);
                        setValue("");
                      }}
                      className="min-h-14 rounded-2xl border border-slate-600 bg-slate-900 px-5 py-3 text-base font-bold text-slate-100 disabled:opacity-60"
                    >
                      Zastavit scan
                    </button>
                  </>
                ) : null}

                {result.decision === "unloading-damaged" ? (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => confirmDecision("return_to_stock")}
                      className="min-h-16 rounded-2xl border border-emerald-500 bg-emerald-600 px-5 py-4 text-lg font-black text-white shadow-lg shadow-emerald-950/40 disabled:opacity-60"
                    >
                      Uložit na sklad
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => confirmDecision("set_aside_damaged")}
                      className="min-h-16 rounded-2xl border border-red-500 bg-red-600 px-5 py-4 text-lg font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
                    >
                      Odložit mimo
                    </button>
                  </>
                ) : null}
              </div>
            </section>
          ) : result?.ok ? (
            <section className="rounded-2xl border border-emerald-700 bg-emerald-950/50 p-5">
              <div className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                {result.action === "nalozeno"
                  ? "Naloženo"
                  : result.action === "vraceno"
                    ? "Vráceno"
                    : "Odloženo mimo"}
              </div>
              <div className="mt-2 text-2xl font-black text-white">{result.kus.itemName}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-700 bg-emerald-950 p-3 text-white">
                  <div className="text-xs text-emerald-300">Kus</div>
                  <div className="text-xl font-black">#{result.kus.poradoveCislo}</div>
                </div>
                <div className="rounded-xl border border-emerald-700 bg-emerald-950 p-3 text-white">
                  <div className="text-xs text-emerald-300">Pozice</div>
                  <div className="text-xl font-black">{positionText(result.kus.pozice)}</div>
                </div>
                <div className="rounded-xl border border-emerald-700 bg-emerald-950 p-3 text-white">
                  <div className="text-xs text-emerald-300">
                    {result.action === "nalozeno" ? "Plán" : "Zbývá vrátit"}
                  </div>
                  <div className="text-xl font-black">
                    {result.action === "nalozeno"
                      ? `${result.counts.loaded}/${result.counts.plan ?? "?"}`
                      : result.counts.remaining}
                  </div>
                </div>
              </div>
              {result.replacementFor ? (
                <div className="mt-4 rounded-2xl border border-blue-700 bg-blue-950/70 p-4 text-sm font-bold text-blue-100">
                  Náhrada za plánovanou položku: {result.replacementFor}
                </div>
              ) : null}
              <Link
                href={`/sklad/kus/${result.kus.kusId}`}
                className="mt-4 inline-flex rounded-xl border border-emerald-600 bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
              >
                Otevřít detail kusu
              </Link>
            </section>
          ) : result && !result.ok ? (
            <section className="rounded-2xl border border-red-900 bg-red-950/50 p-5 text-red-100">
              <div className="text-lg font-black">Scan odmítnut</div>
              <div className="mt-2 text-sm">{result.error}</div>
            </section>
          ) : null}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm leading-relaxed text-slate-300">
            {workflowMode === "loading" ? (
              <>
                Plánované množství zůstává v{" "}
                <code className="text-slate-100">technika_na_zakazce</code>.
                Konkrétní kus vzniká až úspěšným scanem vybrané položky.
              </>
            ) : (
              <>
                Vykládka nevytváří nové vazby ani nemění plán. Pouze mění existující
                fyzicky naložený kus na stav <code className="text-slate-100">vraceno</code>.
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function CountBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-black text-white">{value}</div>
    </div>
  );
}
